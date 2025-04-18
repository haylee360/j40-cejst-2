import pathlib

import numpy as np
import pandas as pd
from data_pipeline.etl.base import ExtractTransformLoad
from data_pipeline.etl.datasource import DataSource
from data_pipeline.etl.datasource import FileDataSource
from data_pipeline.score import field_names
from data_pipeline.utils import get_module_logger
from data_pipeline.config import settings

logger = get_module_logger(__name__)


class MappingInequalityETL(ExtractTransformLoad):
    """Load Mapping Inequality data.

    Information on the source data is available at
    https://dsl.richmond.edu/panorama/redlining/.

    Information on the mapping of this data to census tracts is available at
    https://github.com/americanpanorama/Census_HOLC_Research.
    """

    def __init__(self):

        # fetch
        if settings.DATASOURCE_RETRIEVAL_FROM_AWS:
            self.mapping_inequality_csv_url = (
                f"{settings.AWS_JUSTICE40_DATASOURCES_URL}/raw-data-sources/"
                "mapping_inequality/holc_tract_lookup.csv"
            )
        else:
            self.mapping_inequality_csv_url = (
                "https://raw.githubusercontent.com/americanpanorama/Census_HOLC_Research/"
                "main/2010_Census_Tracts/holc_tract_lookup.csv"
            )

        # input
        self.mapping_inequality_source = (
            self.get_sources_path() / "holc_tract_lookup.csv"
        )
        self.holc_manual_mapping_source = (  # here be dragons – this file is pulled from a different place than most
            pathlib.Path(__file__).parent
            / "data"
            / "holc_grades_manually_mapped.csv"
        )

        # output
        self.CSV_PATH = self.DATA_PATH / "dataset" / "mapping_inequality"

        # Some input field names. From documentation: 'Census Tracts were intersected
        # with HOLC Polygons. Census information can be joined via the "geoid" field.
        # There are two field "holc_prop" and "tract_prop" which give the proportion
        # of the HOLC polygon in the Census Tract and the proportion of Census Tract
        # in the HOLC Polygon respectively.'
        # https://github.com/americanpanorama/Census_HOLC_Research/blob/main/2010_Census_Tracts/README.md
        self.TRACT_INPUT_FIELD: str = "geoid"
        self.TRACT_PROPORTION_FIELD: str = "tract_prop"
        self.HOLC_GRADE_AND_ID_FIELD: str = "holc_id"
        self.CITY_INPUT_FIELD: str = "city"

        self.HOLC_GRADE_D_FIELD: str = "HOLC Grade D (hazardous)"
        self.HOLC_GRADE_C_FIELD: str = "HOLC Grade C (declining)"
        self.HOLC_GRADE_MANUAL_FIELD: str = "HOLC Grade (manually mapped)"
        self.HOLC_GRADE_DERIVED_FIELD: str = "HOLC Grade (derived)"

        self.COLUMNS_TO_KEEP = [
            self.GEOID_TRACT_FIELD_NAME,
            field_names.HOLC_GRADE_C_TRACT_PERCENT_FIELD,
            field_names.HOLC_GRADE_C_OR_D_TRACT_PERCENT_FIELD,
            field_names.HOLC_GRADE_C_OR_D_TRACT_50_PERCENT_FIELD,
            field_names.HOLC_GRADE_D_TRACT_PERCENT_FIELD,
            field_names.HOLC_GRADE_D_TRACT_20_PERCENT_FIELD,
            field_names.HOLC_GRADE_D_TRACT_50_PERCENT_FIELD,
            field_names.HOLC_GRADE_D_TRACT_75_PERCENT_FIELD,
            field_names.REDLINED_SHARE,
        ]

        self.df: pd.DataFrame
        self.holc_manually_mapped_df: pd.DataFrame

    def get_data_sources(self) -> [DataSource]:
        return [
            FileDataSource(
                source=self.mapping_inequality_csv_url,
                destination=self.mapping_inequality_source,
            )
        ]

    def extract(self, use_cached_data_sources: bool = False) -> None:

        super().extract(
            use_cached_data_sources
        )  # download and extract data sources

        self.df = pd.read_csv(
            self.mapping_inequality_source,
            dtype={self.TRACT_INPUT_FIELD: "string"},
            low_memory=False,
        )

        # Some data needs to be manually mapped to its grade.
        # TODO: Investigate more data that may need to be manually mapped.
        self.holc_manually_mapped_df = pd.read_csv(
            filepath_or_buffer=self.holc_manual_mapping_source,
            low_memory=False,
        )

    def transform(self) -> None:

        # rename Tract ID
        self.df.rename(
            columns={
                self.TRACT_INPUT_FIELD: self.GEOID_TRACT_FIELD_NAME,
            },
            inplace=True,
        )

        # Keep the first character, which is the HOLC grade (A, B, C, D).
        # TODO: investigate why this dataframe triggers these pylint errors.
        # pylint: disable=unsupported-assignment-operation, unsubscriptable-object
        self.df[self.HOLC_GRADE_DERIVED_FIELD] = self.df[
            self.HOLC_GRADE_AND_ID_FIELD
        ].str[0:1]

        # Remove nonsense when the field has no grade or invalid grades.
        valid_grades = ["A", "B", "C", "D"]
        self.df.loc[
            # pylint: disable=unsubscriptable-object
            ~self.df[self.HOLC_GRADE_DERIVED_FIELD].isin(valid_grades),
            self.HOLC_GRADE_DERIVED_FIELD,
        ] = None

        # Join on the existing data
        merged_df = self.df.merge(
            right=self.holc_manually_mapped_df,
            on=[self.HOLC_GRADE_AND_ID_FIELD, self.CITY_INPUT_FIELD],
            how="left",
        )

        # Create a single field that combines the 'derived' grade C and D fields with the
        # manually mapped grade C and D field into a single grade C and D field.
        ## Note: there are no manually derived C tracts at the moment

        for grade, field_name in [
            ("C", self.HOLC_GRADE_C_FIELD),
            ("D", self.HOLC_GRADE_D_FIELD),
        ]:
            merged_df[field_name] = np.where(
                (merged_df[self.HOLC_GRADE_DERIVED_FIELD] == grade)
                | (merged_df[self.HOLC_GRADE_MANUAL_FIELD] == grade),
                True,
                None,
            )

        redlined_dataframes_list = [
            merged_df[merged_df[field].fillna(False)]
            .groupby(self.GEOID_TRACT_FIELD_NAME)[self.TRACT_PROPORTION_FIELD]
            .sum()
            .rename(new_name)
            for field, new_name in [
                (
                    self.HOLC_GRADE_D_FIELD,
                    field_names.HOLC_GRADE_D_TRACT_PERCENT_FIELD,
                ),
                (
                    self.HOLC_GRADE_C_FIELD,
                    field_names.HOLC_GRADE_C_TRACT_PERCENT_FIELD,
                ),
            ]
        ]

        # Group by tract ID to get tract proportions of just C or just D
        # This produces a single row per tract
        grouped_df = (
            pd.concat(
                redlined_dataframes_list,
                axis=1,
            )
            .fillna(0)
            .reset_index()
        )

        grouped_df[
            field_names.HOLC_GRADE_C_OR_D_TRACT_PERCENT_FIELD
        ] = grouped_df[
            [
                field_names.HOLC_GRADE_C_TRACT_PERCENT_FIELD,
                field_names.HOLC_GRADE_D_TRACT_PERCENT_FIELD,
            ]
        ].sum(
            axis=1
        )

        # Calculate some specific threshold cutoffs, for convenience.
        grouped_df[field_names.HOLC_GRADE_D_TRACT_20_PERCENT_FIELD] = (
            grouped_df[field_names.HOLC_GRADE_D_TRACT_PERCENT_FIELD] > 0.2
        )
        grouped_df[field_names.HOLC_GRADE_D_TRACT_50_PERCENT_FIELD] = (
            grouped_df[field_names.HOLC_GRADE_D_TRACT_PERCENT_FIELD] > 0.5
        )
        grouped_df[field_names.HOLC_GRADE_D_TRACT_75_PERCENT_FIELD] = (
            grouped_df[field_names.HOLC_GRADE_D_TRACT_PERCENT_FIELD] > 0.75
        )

        grouped_df[field_names.HOLC_GRADE_C_OR_D_TRACT_50_PERCENT_FIELD] = (
            grouped_df[field_names.HOLC_GRADE_C_OR_D_TRACT_PERCENT_FIELD] > 0.5
        )

        # Create the indicator we will use
        grouped_df[field_names.REDLINED_SHARE] = (
            grouped_df[field_names.HOLC_GRADE_C_OR_D_TRACT_PERCENT_FIELD] > 0.5
        ) & (grouped_df[field_names.HOLC_GRADE_D_TRACT_PERCENT_FIELD] > 0)

        # Sort for convenience.
        grouped_df.sort_values(by=self.GEOID_TRACT_FIELD_NAME, inplace=True)

        # Save to self.
        self.df = grouped_df

    def load(self) -> None:
        # write nationwide csv
        self.CSV_PATH.mkdir(parents=True, exist_ok=True)
        self.df[self.COLUMNS_TO_KEEP].to_csv(
            self.CSV_PATH / "usa.csv", index=False
        )
