# Notes
This repository is massive and I'm using this markdown to keep track of places that will need our attention for various tasks

## Adding a Layer to the Application

Files to check:

- `data/data-pipeline/data_pipeline/score/adding_variables_to_score.md` is the markdown with information about important files to check and modify when adding data. Will need to modify to fit our needs, but it's a good start. 

- `data/data-pipeline/data_pipeline/application.py` houses commands (?) about generating the tiles, including the score tiles and tribal tiles. Will need to edit this to include our new layer?

Files I modified:

- `data/data-pipeline/data_pipeline/tile/generate.py` I copied a second set of the entire script but with chatgpt's version for adding a G star layer. Haven't tried it yet, but 99% sure it's not going to work. 

- `data/data-pipeline/data_pipeline/etl/sources/gstar_test` A test folder to add the tract ID and standardized G star scores. 

## Scoring

- `data/data-pipeline/data_pipeline/etl/score/etl_score.py` houses the bulk of merging the datasets and calculating the actual score. It feels like the output of this should be the `usa.csv` with everything. `~/etl/score/etl_utils.py` handles the generation of the codebook and the actualy converting to csv, xlsx, shp, etc. 

## Extract, Transform, Load

- Every dataset in `data/data-pipeline/data_pipeline/etl/sources` has an `etl.py` file. This file **defines a subclass of `ExtractTransformLoad` that is unique to that dataset.** 

    For instance, `~etl/sources/nlcd_nature_deprived/etl.py` defines a specific ETL class for the Nature Deprived Communities dataset. It builds off of the template `ExtractTransformLoad` class but tunes specific variables to meet the needs of this dataset. Every dataset CEJST uses has its own ETL subclass customized to that data.

    In essence, rather than manually typing out the data wrangling and processing, CEJST uses the ETL framework to make all of the data management robust and reproducible. It's harder to parse, but I think I'm finally starting to grasp 1. Where the data is and 2. What they're doing with it. 

## Miscellaneous

- `data/data-pipeline/settings.toml` houses the Amazon AWS links to the data. Neither version 1 nor version 2 links work.

- `data/data-pipeline/data_pipeline/etl/score/constants.py` contains the column names of the geo data frame. They're also in the codebook, but this is where they're defined. 

- `data/data-pipeline/data_pipeline/etl/sources/geo_utils.py`: Utililities for turning geographies into tracts using census data


