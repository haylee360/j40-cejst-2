import pandas as pd
from data_pipeline.etl.base import ExtractTransformLoad
from data_pipeline.etl.datasource import DataSource
from data_pipeline.utils import get_module_logger

logger = get_module_logger(__name__)


class EJSCREENAreasOfConcernETL(ExtractTransformLoad):
    # Note: while we normally set these properties in `__init__`,
    # we are setting them as class properties here so they can be accessed by the
    # class method `ejscreen_areas_of_concern_data_exists`.

    EJSCREEN_AREAS_OF_CONCERN_SOURCE = (
        ExtractTransformLoad.DATA_PATH
        / "sources"
        / "EJSCREENAreasOfConcernETL"
        / "ejscreen_areas_of_concerns_indicators.csv"
    )

    def __init__(self):

        # output
        self.OUTPUT_PATH = (
            self.DATA_PATH / "dataset" / "ejscreen_areas_of_concern"
        )

        # TO DO: Load from actual source; the issue is that this dataset is not public for now
        self.df: pd.DataFrame

    def get_data_sources(self) -> [DataSource]:
        """The source for this must be downloaded and saved manually. It is not publicly available"""
        return []

    @classmethod
    def ejscreen_areas_of_concern_data_exists(cls):
        """Check whether or not the EJSCREEN areas of concern data exists.

        Note: this data is provided privately and is not currently publicly available.

        To enable the ETL code for EJSCREEN AoCs to run appropriately whether or not the person
        running it has access to that data, the following method checks whether the source file exists.

        If it does exist, code can and should include this data. If it does not exist, code should
        not reference this data.

        """
        return cls.EJSCREEN_AREAS_OF_CONCERN_SOURCE.is_file()

    def extract(self, use_cached_data_sources: bool = False) -> None:

        super().extract(
            use_cached_data_sources
        )  # download and extract data sources

        logger.info(self.EJSCREEN_AREAS_OF_CONCERN_SOURCE)
        if self.ejscreen_areas_of_concern_data_exists():
            logger.debug("Loading EJSCREEN Areas of Concern Data Locally")
            self.df = pd.read_csv(
                filepath_or_buffer=self.EJSCREEN_AREAS_OF_CONCERN_SOURCE,
                dtype={
                    self.GEOID_FIELD_NAME: "string",
                },
                low_memory=False,
            )
        else:
            logger.warning(
                "EJSCREEN areas of concern data does not exist locally. Not loading the data."
            )

    def transform(self) -> None:
        logger.debug("Transforming EJSCREEN Areas of Concern Data")

        # TO DO: As a one off we did all the processing in a separate Notebook
        # Can add here later for a future PR

    def load(self) -> None:
        if self.ejscreen_areas_of_concern_data_exists():
            logger.debug("Saving EJSCREEN Areas of Concern Data")
            # write nationwide csv
            self.OUTPUT_PATH.mkdir(parents=True, exist_ok=True)
            self.df.to_csv(self.OUTPUT_PATH / "usa.csv", index=False)

        else:
            logger.warning(
                "EJSCREEN areas of concern data does not exist locally. Not saving the data."
            )
