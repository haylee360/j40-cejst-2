import csv
from enum import Enum
from pathlib import Path

import geopandas as gpd
import pandas as pd
from data_pipeline.etl.base import ExtractTransformLoad
from data_pipeline.etl.sources.census.etl_utils import get_state_fips_codes
from data_pipeline.utils import get_module_logger
from data_pipeline.etl.datasource import DataSource
from data_pipeline.etl.datasource import ZIPDataSource

logger = get_module_logger(__name__)


class GeoFileType(Enum):
    SHP = 1
    GEOJSON = 2
    CSV = 3


class CensusETL(ExtractTransformLoad):
    # SHP_BASE_PATH = ExtractTransformLoad.DATA_PATH / "census" / "shp"
    GEOJSON_BASE_PATH = ExtractTransformLoad.DATA_PATH / "census" / "geojson"
    CSV_BASE_PATH = ExtractTransformLoad.DATA_PATH / "census" / "csv"
    GEOJSON_PATH = ExtractTransformLoad.DATA_PATH / "census" / "geojson"
    NATIONAL_TRACT_CSV_PATH = CSV_BASE_PATH / "us.csv"
    NATIONAL_TRACT_JSON_PATH = GEOJSON_BASE_PATH / "us_geo.parquet"
    GEOID_TRACT_FIELD_NAME: str = "GEOID10"

    def __init__(self):

        self.shape_file_path = self.get_sources_path() / "shp"

        # the fips_states_2010.csv is generated from data here
        # https://www.census.gov/geographies/reference-files/time-series/geo/tallies.html
        self.STATE_FIPS_CODES = get_state_fips_codes(self.DATA_PATH)
        self.TRACT_PER_STATE: dict = {}  # in-memory dict per state
        self.TRACT_NATIONAL: list = []  # in-memory global list

    def _path_for_fips_file(
        self, fips_code: str, file_type: GeoFileType
    ) -> Path:
        """Get paths for associated geospatial files for the provided FIPS code

        Args:
            fips_code (str): the FIPS code for the region of interest
            file_type (GeoFileType): the geo file type of interest

        Returns:
            Path on disk to the file_type file corresponding to this FIPS
        """
        file_path: Path
        if file_type == GeoFileType.SHP:
            file_path = Path(
                self.shape_file_path
                / fips_code
                / f"tl_2010_{fips_code}_tract10.shp"
            )
        elif file_type == GeoFileType.GEOJSON:
            file_path = Path(self.GEOJSON_BASE_PATH / f"{fips_code}.parquet")
        elif file_type == GeoFileType.CSV:
            file_path = Path(self.CSV_BASE_PATH / f"{fips_code}.csv")
        return file_path

    def get_data_sources(self) -> [DataSource]:

        sources = []

        for fips_code in self.STATE_FIPS_CODES:

            tract_state_url = f"https://www2.census.gov/geo/tiger/TIGER2010/TRACT/2010/tl_2010_{fips_code}_tract10.zip"
            destination_path = self.shape_file_path / fips_code

            sources.append(
                ZIPDataSource(
                    source=tract_state_url, destination=destination_path
                )
            )

        return sources

    def _transform_to_geojson(self, fips_code: str) -> None:
        """Convert the downloaded SHP file for the associated FIPS to geojson

        Returns:
            None
        """
        shp_file_path = self._path_for_fips_file(fips_code, GeoFileType.SHP)
        geojson_file_path = self._path_for_fips_file(
            fips_code, GeoFileType.GEOJSON
        )

        if not geojson_file_path.is_file():
            gdf = gpd.read_file(shp_file_path)
            gdf.to_parquet(geojson_file_path)

    def _generate_tract_table(self) -> None:
        """Generate Tract CSV table for pandas, load in memory

        Returns:
            None
        """
        logger.debug("Transforming tracts")

        files = list(self.GEOJSON_BASE_PATH.glob("[0-9]*.parquet"))
        files.sort()
        for file in files:
            logger.debug(f"Adding GEOID10 for file {file.name}")
            state_df = gpd.read_parquet(file)
            tract_list = state_df["GEOID10"].to_list()
            self.TRACT_NATIONAL.extend(tract_list)
            tractid10_state_id = state_df["STATEFP10"][0]
            self.TRACT_PER_STATE[tractid10_state_id] = tract_list

    def transform(self) -> None:
        """Download all census shape files from the Census FTP and extract the geojson
        to generate national and by state Census tract CSVs and GeoJSONs

        Returns:
            None
        """
        logger.debug("Transforming census data")

        logger.debug("Transforming SHP files to GeoJSON")
        for index, fips_code in enumerate(self.STATE_FIPS_CODES):
            logger.debug(
                f"Transforming FIPS {fips_code} to GeoJSON – {index+1} of {len(self.STATE_FIPS_CODES)}"
            )
            self._transform_to_geojson(fips_code)

        self._generate_tract_table()

    def _load_into_state_csvs(self, fips_code: str) -> None:
        """Load state CSVs into individual CSV files

        Args:
            fips_code (str): the FIPS code for the region of interest

        Returns:
            None
        """
        ## write to individual state csv
        tractid10_list = self.TRACT_PER_STATE[fips_code]
        csv_path = self._path_for_fips_file(fips_code, GeoFileType.CSV)
        with open(
            csv_path, mode="w", newline="", encoding="utf-8"
        ) as cbg_csv_file:
            tract_csv_file_writer = csv.writer(
                cbg_csv_file,
                delimiter=",",
                quotechar='"',
                quoting=csv.QUOTE_MINIMAL,
            )

            for tractid10 in tractid10_list:
                tract_csv_file_writer.writerow(
                    [
                        tractid10,
                    ]
                )

    def _load_national_csv(self):
        """Write national-level csv combining

        Returns:
            None
        """
        logger.debug("Loading national US.csv")

        if not self.NATIONAL_TRACT_CSV_PATH.is_file():
            with open(
                self.NATIONAL_TRACT_CSV_PATH,
                mode="w",
                newline="",
                encoding="utf-8",
            ) as cbg_csv_file:
                cbg_csv_file_writer = csv.writer(
                    cbg_csv_file,
                    delimiter=",",
                    quotechar='"',
                    quoting=csv.QUOTE_MINIMAL,
                )
                for geoid10 in self.TRACT_NATIONAL:
                    cbg_csv_file_writer.writerow(
                        [
                            geoid10,
                        ]
                    )

    def _load_national_geojson(self):
        """Create national geojson

        Returns:
            None
        """
        logger.debug("Loading National GeoJson")

        usa_df = gpd.GeoDataFrame()

        # Read state only files and append them into a MEGA US GPD
        files = list(self.GEOJSON_BASE_PATH.glob("[0-9]*.parquet"))
        files.sort()
        for file_name in files:
            logger.debug(f"Adding national GeoJSON file {file_name.name}")
            state_gdf = gpd.read_parquet(file_name)
            usa_df = pd.concat([usa_df, state_gdf], ignore_index=True)

        assert len(usa_df.columns) > 0
        logger.debug("Converting to CRS")
        usa_df = usa_df.to_crs("EPSG:4326")

        logger.debug("Saving national GeoJSON file")
        # Convert tract ID to a string
        usa_df[self.GEOID_TRACT_FIELD_NAME] = usa_df[
            self.GEOID_TRACT_FIELD_NAME
        ].astype(str, errors="ignore")
        usa_df.to_parquet(self.NATIONAL_TRACT_JSON_PATH)

    def load(self) -> None:
        """Create state CSVs, National CSV, and National GeoJSON

        Returns:
            None
        """
        logger.debug("Loading census data")

        logger.debug("Loading individual state csv files")
        for fips_code in self.TRACT_PER_STATE:
            self._load_into_state_csvs(fips_code)

        self._load_national_csv()
        self._load_national_geojson()

        logger.debug("Census data complete")
