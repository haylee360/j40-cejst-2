/* eslint-disable valid-jsdoc */
/* eslint-disable no-unused-vars */
// External Libs:
import React, {useRef, useState} from 'react';
import {Map, MapGeoJSONFeature, LngLatBoundsLike} from 'maplibre-gl';
import ReactMapGL, {
  MapEvent,
  ViewportProps,
  WebMercatorViewport,
  NavigationControl,
  GeolocateControl,
  Popup,
  FlyToInterpolator,
  FullscreenControl,
  MapRef,
} from 'react-map-gl';
import {useIntl} from 'gatsby-plugin-intl';
import bbox from '@turf/bbox';
import * as d3 from 'd3-ease';
import {isMobile} from 'react-device-detect';
import {Grid} from '@trussworks/react-uswds';
import {useWindowSize, useLocalStorage} from 'react-use';

// Contexts:
import {useFlags} from '../contexts/FlagContext';

// Components:
import AreaDetail from './AreaDetail';
import MapInfoPanel from './mapInfoPanel';
import MapSearch from './MapSearch';
import MapTractLayers from './MapTractLayers/MapTractLayers';
// import MapTribalLayer from './MapTribalLayers/MapTribalLayers';
import TerritoryFocusControl from './territoryFocusControl';
// import {getInteractiveLayerIds} from './Utils/getInteractiveLayerIds';
import Colorbar from './Colorbar/Colorbar';

// Styles and constants
import 'maplibre-gl/dist/maplibre-gl.css';
import * as constants from '../data/constants';
import * as styles from './J40Map.module.scss';
import * as EXPLORE_COPY from '../data/copy/explore';

declare global {
  interface Window {
    Cypress?: object;
    underlyingMap: Map;
  }
}

interface IJ40Interface {
  location: Location;
}

export interface IDetailViewInterface {
  latitude: number;
  longitude: number;
  zoom: number;
  properties: constants.J40Properties;
}

export interface IMapFeature {
  id: string;
  geometry: any;
  properties: any;
  type: string;
}

const J40Map = ({location}: IJ40Interface) => {
  /**
   * Initializes the zoom, and the map's center point (lat, lng) via the URL hash #{z}/{lat}/{long}
   * where
   *  @TODO: These values do not update when zooming in/out. Could explain a number of cypress bugs
   *  reference to ticket #1550
   *
   *    z = zoom
   *    lat = map center's latitude
   *    long = map center's longitude
   */
  const [zoom, lat, lng] = location.hash.slice(1).split('/');

  /**
   * If the URL has no #{z}/{lat}/{long} specified in the hash, then set the map's intial viewport state
   * to use constants. This is so that we can load URLs with certain zoom/lat/long specified:
   */
  const [viewport, setViewport] = useState<ViewportProps>({
    latitude:
      lat && parseFloat(lat) ? parseFloat(lat) : constants.DEFAULT_CENTER[0],
    longitude:
      lng && parseFloat(lng) ? parseFloat(lng) : constants.DEFAULT_CENTER[1],
    zoom:
      zoom && parseFloat(zoom) ? parseFloat(zoom) : constants.GLOBAL_MIN_ZOOM,
  });

  // NEWEST ADD
  const [visibleLayer, setVisibleLayer] = useState<string>(
      constants.ADD_BURDEN_LAYER_ID,
  );
  const [interactiveLayerIds, setInteractiveLayerIds] = useState<string[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<MapGeoJSONFeature>();
  const [detailViewData, setDetailViewData] = useState<IDetailViewInterface>();
  const [transitionInProgress, setTransitionInProgress] =
    useState<boolean>(false);
  const [geolocationInProgress, setGeolocationInProgress] =
    useState<boolean>(false);
  const [isMobileMapState, setIsMobileMapState] = useState<boolean>(false);
  const [selectTractId, setSelectTractId] = useState<string | undefined>(
      undefined,
  );
  const {width: windowWidth} = useWindowSize();

  /**
   * Store the geolocation lock state in local storage. The Geolocation component from MapBox does not
   * expose (API) various geolocation lock/unlock states in the version we are using. This makes it
   * challenging to change the UI state to match the Geolocation state. A work around is to store the
   * geolocation "locked" state in local storage. The local storage state will then be used to show the
   * "Finding location" message. The local storage will be removed everytime the map is reloaded.
   *
   * The "Finding location" message only applies for desktop layouts.
   */
  // eslint-disable-next-line max-len
  const [isGeolocateLocked, setIsGeolocateLocked, removeGeolocateLock] =
    useLocalStorage('is-geolocate-locked', false, {raw: true});

  const mapRef = useRef<MapRef>(null);
  const flags = useFlags();
  const intl = useIntl();

  const selectedFeatureId = (selectedFeature && selectedFeature.id) || '';
  const zoomLatLngHash = mapRef.current?.getMap()._hash._getCurrentHash();

  /**
   * Selects the provided feature on the map.
   * @param feature the feature to select
   */
  const selectFeatureOnMap = (feature: IMapFeature) => {
    if (feature) {
      // Get the current selected feature's bounding box:
      const [minLng, minLat, maxLng, maxLat] = bbox(feature);

      // Set the selectedFeature ID
      setSelectedFeature(feature as MapGeoJSONFeature);

      // Go to the newly selected feature (as long as it's not an Alaska Point)
      goToPlace([
        [minLng, minLat],
        [maxLng, maxLat],
      ]);

      /**
       * The following logic is used for the popup for the fullscreen feature
       */
      // Create a new viewport using the current viewport dimnesions:
      const newViewPort = new WebMercatorViewport({
        height: viewport.height!,
        width: viewport.width!,
      });

      // Fit the viewport to the new bounds and return a long, lat and zoom:
      const {longitude, latitude, zoom} = newViewPort.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          {
            padding: 40,
          },
      );

      // Save the popupInfo
      const popupInfo = {
        longitude: longitude,
        latitude: latitude,
        zoom: zoom,
        properties: feature.properties,
      };

      // Update the DetailedView state variable with the new popupInfo object:
      setDetailViewData(popupInfo);

      /**
       * End Fullscreen feature specific logic
       */
    }
  };

  /**
   * This onClick event handler will listen and handle clicks on the map. It will listen for clicks on the
   * territory controls and it will listen to clicks on the map.
   *
   * It will NOT listen to clicks into the search field or the zoom controls. These clickHandlers are
   * captured in their own respective components.
   */
  const onClick = (event: MapEvent | React.MouseEvent<HTMLButtonElement>) => {
    // Stop all propagation / bubbling / capturing
    event.preventDefault();
    (event as React.MouseEvent<HTMLButtonElement>).stopPropagation?.();

    // Check if the click is for territories. Given the territories component's design, it can be
    // guaranteed that each territory control will have an id. We use this ID to determine
    // if the click is coming from a territory control
    if (event.target && (event.target as HTMLElement).id) {
      const buttonID = event.target && (event.target as HTMLElement).id;

      switch (buttonID) {
        case '48':
          goToPlace(constants.LOWER_48_BOUNDS, true);
          break;
        case 'AK':
          goToPlace(constants.ALASKA_BOUNDS, true);
          break;
        case 'HI':
          goToPlace(constants.HAWAII_BOUNDS, true);
          break;
        case 'PR':
          goToPlace(constants.PUERTO_RICO_BOUNDS, true);
          break;
        case 'GU':
          goToPlace(constants.GUAM_BOUNDS, true);
          break;
        case 'AS':
          goToPlace(constants.AMERICAN_SAMOA_BOUNDS, true);
          break;
        case 'MP':
          goToPlace(constants.MARIANA_ISLAND_BOUNDS, true);
          break;
        case 'VI':
          goToPlace(constants.US_VIRGIN_ISLANDS_BOUNDS, true);
          break;

        default:
          break;
      }
    } else if (
      event.target &&
      (event.target as HTMLElement).nodeName == 'DIV'
    ) {
      // This else clause will fire when the user clicks on the map and will ignore other controls
      // such as the search box and buttons.

      // @ts-ignore
      const feature = event.features && event.features[0];

      selectFeatureOnMap(feature);
    }
  };

  const onLoad = () => {
    if (typeof window !== 'undefined' && window.Cypress && mapRef.current) {
      window.underlyingMap = mapRef.current.getMap();
    }

    // When map loads remove the geolocate lock boolean in local storage
    removeGeolocateLock();

    if (isMobile) setIsMobileMapState(true);
  };

  /**
   * This function will move the map (with easing) to the given lat/long bounds.
   *
   * When a user clicks on a tracts vs a territory button, the zoom level returned by the fitBounds
   * function differ. Given that we want to handle the zoom differently depending on these two cases, we
   * introduce a boolean, isTerritory that will allow the zoom level to be set depending on what the user
   * is interacting with, namely a tract vs a territory button.
   *
   * @param {LngLatBoundsLike} bounds
   * @param {boolean} isTerritory
   */
  const goToPlace = (
      bounds: LngLatBoundsLike,
      isTerritory = false,
      selectTractId: string | undefined = undefined,
  ) => {
    const newViewPort = new WebMercatorViewport({
      height: viewport.height!,
      width: viewport.width!,
    });
    const {longitude, latitude, zoom} = newViewPort.fitBounds(
      bounds as [[number, number], [number, number]],
      {
        // padding: 200,  // removing padding and offset in favor of a zoom offset below
        // offset: [0, -100],
      },
    );

    /**
     * When some tracts are selected, they end up too far zoomed in, causing some census tracts to
     * only show a portion of the tract in the viewport. We reduce the zoom level by 1 to allow
     * more space around the selected tract.
     *
     * Given that the high zoom tiles only go to zoom level 5, if the corrected zoom level (zoom - 1) is
     * less than MIN_ZOOM_FEATURE_BORDER, then we floor the zoom to MIN_ZOOM_FEATURE_BORDER + .1 (which
     * is 5.1 as of this comment)
     */
    // eslint-disable-next-line max-len
    const featureSelectionZoomLevel =
      zoom - 1 < constants.GLOBAL_MIN_ZOOM_FEATURE_BORDER + 0.1 ?
        constants.GLOBAL_MIN_ZOOM_FEATURE_BORDER :
        zoom - 1;

    setViewport({
      ...viewport,
      longitude,
      latitude,
      zoom: isTerritory ? zoom : featureSelectionZoomLevel,
      transitionDuration: 1000,
      transitionInterpolator: new FlyToInterpolator(),
      transitionEasing: d3.easeCubic,
    });

    // Set the tract ID to be selected if any.
    setSelectTractId(selectTractId);
  };

  const onTransitionStart = () => {
    setTransitionInProgress(true);
  };

  const onTransitionEnd = () => {
    setTransitionInProgress(false);

    /*
    If there is a tract ID to be selected then do so once the map has finished moving.
    Note that setting the viewpoint to move the map as done in this component does not
    trigger a moveend or idle event like when using flyTo or easeTo.
    */
    if (selectTractId) {
      // Search for features in the map that have the tract ID.
      const geoidSearchResults = mapRef.current
          ?.getMap()
          .querySourceFeatures(constants.HIGH_ZOOM_SOURCE_NAME, {
            sourceLayer: constants.SCORE_SOURCE_LAYER,
            validate: true,
            filter: ['==', constants.GEOID_PROPERTY, selectTractId],
          });
      if (geoidSearchResults && geoidSearchResults.length > 0) {
        selectFeatureOnMap(geoidSearchResults[0]);
      }
      setSelectTractId(undefined);
    }
  };

  const onGeolocate = () => {
    setGeolocationInProgress(false);

    // set local storage that location was locked on this app at some point
    setIsGeolocateLocked(true);
  };

  const onClickGeolocate = () => {
    setGeolocationInProgress(true);
  };

  return (
    <>
      <Grid desktop={{col: 9}} className={styles.j40Map}>
        <div
          style={{
            position: 'relative',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{flex: 1, minHeight: 0}}>
            {/**
             * Note:
             * The MapSearch component is no longer used in this location. It has been moved inside the
             * <ReactMapGL> component itself.
             *
             * It was originally wrapped in a div in order to allow this feature
             * to be behind a feature flag. This was causing a bug for MapSearch to render
             * correctly in a production build. Leaving this comment here in case future flags are
             * needed in this component.
             *
             * When the MapSearch component is placed behind a feature flag without a div wrapping
             * MapSearch, the production build will inject CSS due to the null in the false conditional
             * case. Any changes to this (ie, changes to MapSearch or removing feature flag, etc), should
             * be tested with a production build via:
             *   - npm run clean && npm run build && npm run serve
             *
             * to ensure the production build works and that MapSearch and the map (ReactMapGL) render correctly.
             *
             * Any component declarations outside the <ReactMapGL> component may be susceptible to this bug.
             */}

            {/**
             * The ReactMapGL component's props are grouped by the API's documentation. The component also has
             * some children.
             */}
            <ReactMapGL
              // ****** Initialization props: ******
              // access token is j40StylesReadToken
              mapboxApiAccessToken={
                process.env.MAPBOX_STYLES_READ_TOKEN ?
                  process.env.MAPBOX_STYLES_READ_TOKEN :
                  ''
              }
              // ****** Map state props: ******
              // http://visgl.github.io/react-map-gl/docs/api-reference/interactive-map#map-state
              {...viewport}
              mapStyle={
                process.env.MAPBOX_STYLES_READ_TOKEN ?
                  'mapbox://styles/justice40/cl9g30qh7000p15l9cp1ftw16' :
                  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
              }
              width="100%"
              // Ajusting this height with a conditional statement will not render the map on staging.
              // The reason for this issue is unknown. Consider styling the parent container via SASS.
              height="100%"
              mapOptions={{hash: true}}
              // ****** Interaction option props: ******
              // http://visgl.github.io/react-map-gl/docs/api-reference/interactive-map#interaction-options
              maxZoom={constants.GLOBAL_MAX_ZOOM}
              minZoom={constants.GLOBAL_MIN_ZOOM}
              dragRotate={false}
              touchRotate={false}
              // eslint-disable-next-line max-len
              // interactiveLayerIds={[
              //   constants.HIGH_ZOOM_LAYER_ID,
              //   constants.PRIORITIZED_HIGH_ZOOM_LAYER_ID,
              // ]}
              interactiveLayerIds={interactiveLayerIds}
              // ****** Callback props: ******
              // http://visgl.github.io/react-map-gl/docs/api-reference/interactive-map#callbacks
              onViewportChange={setViewport}
              onClick={onClick}
              onLoad={onLoad}
              onTransitionStart={onTransitionStart}
              onTransitionEnd={onTransitionEnd}
              ref={mapRef}
              data-cy={'reactMapGL'}
            >
              {
                /* Tribal layer is baked into Mapbox source,
                 * only render here if we're not using that
                 **/
                // process.env.MAPBOX_STYLES_READ_TOKEN || <MapTribalLayer />
              }

              <MapTractLayers
                selectedFeatureId={selectedFeature?.id || ''} // Pass the selected feature ID
                selectedFeature={selectedFeature}
                visibleLayer={visibleLayer}
                setVisibleLayer={setVisibleLayer}
                setInteractiveLayerIds={setInteractiveLayerIds}
              />

              {/* <MapTractLayers
            visibleLayer={visibleLayer}
            setVisibleLayer={setVisibleLayer}
            setInteractiveLayerIds={setInteractiveLayerIds}
            selectedFeatureId={selectedFeatureId}
            selectedFeature={selectedFeature}
            visibleLayers={[visibleLayer]} // Adjust as needed
            setVisibleLayers={(layers) => setVisibleLayer(layers[0])} // Adjust as needed
          /> */}

              {/* This is the first overlayed row on the map: Search and Geolocation */}
              <div className={styles.mapHeaderRow}>
                <MapSearch goToPlace={goToPlace} />

                {/* Geolocate Icon */}
                <div className={styles.geolocateBox}>
                  <GeolocateControl
                    positionOptions={{enableHighAccuracy: true}}
                    onGeolocate={onGeolocate}
                    onClick={onClickGeolocate}
                    trackUserLocation={
                      windowWidth < constants.USWDS_BREAKPOINTS.MOBILE_LG
                    }
                    showUserHeading={
                      windowWidth < constants.USWDS_BREAKPOINTS.MOBILE_LG
                    }
                    // Copolit said we should remove this entirely because it's not valid
                    disabledLabel={intl.formatMessage(
                        EXPLORE_COPY.MAP.GEOLOC_MSG_DISABLED,
                    )}
                  />
                  {windowWidth > constants.USWDS_BREAKPOINTS.MOBILE_LG - 1 && (
                    <div
                      className={
                        geolocationInProgress && !isGeolocateLocked ?
                          styles.geolocateMessage :
                          styles.geolocateMessageHide
                      }
                    >
                      {intl.formatMessage(EXPLORE_COPY.MAP.GEOLOC_MSG_LOCATING)}
                    </div>
                  )}
                </div>
              </div>

              {/* This is the second row overlayed on the map, it will add the navigation controls
          of the zoom in and zoom out buttons */}
              {windowWidth > constants.USWDS_BREAKPOINTS.MOBILE_LG && (
                <NavigationControl
                  showCompass={false}
                  className={styles.navigationControl}
                />
              )}

              {/* This is the third row overlayed on the map, it will show shortcut buttons to
          pan/zoom to US territories */}
              {windowWidth > constants.USWDS_BREAKPOINTS.MOBILE_LG && (
                <TerritoryFocusControl onClick={onClick} />
              )}

              {/* Enable fullscreen pop-up behind a feature flag */}
              {'fs' in flags && detailViewData && !transitionInProgress && (
                <Popup
                  className={styles.j40Popup}
                  tipSize={5}
                  anchor="top"
                  longitude={detailViewData.longitude!}
                  latitude={detailViewData.latitude!}
                  closeOnClick={true}
                  onClose={setDetailViewData}
                  captureScroll={true}
                >
                  <AreaDetail
                    properties={detailViewData.properties}
                    visibleLayer={visibleLayer}
                    hash={zoomLatLngHash}
                  />
                </Popup>
              )}
              {'fs' in flags ? (
                <FullscreenControl className={styles.fullscreenControl} />
              ) : (
                ''
              )}
            </ReactMapGL>
          </div>
          <Colorbar visibleLayer={visibleLayer} />
        </div>
      </Grid>

      <Grid desktop={{col: 3}}>
        <MapInfoPanel
          className={styles.mapInfoPanel}
          featureProperties={detailViewData?.properties}
          selectedFeatureId={selectedFeature?.id}
          hash={zoomLatLngHash}
          visibleLayer={visibleLayer} // Pass the visibleLayer state
        />
      </Grid>
    </>
  );
};

export default J40Map;
