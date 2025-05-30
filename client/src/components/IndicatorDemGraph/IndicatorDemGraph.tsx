import React, {useState, useEffect} from 'react';
import * as Plot from '@observablehq/plot';
import * as d3 from 'd3';

import * as CONSTANTS from '../../data/constants';

interface Props {
  url: string;
}

const IndicatorDemGraph = ({url}: Props) => {
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the data
    // const url =
    //   'http://localhost:5001/data/data-pipeline/data_pipeline/data/score/geojson/ind_dem_long.json';
    console.log('Fetching data from:', url);

    fetch(url)
        .then((response) => {
          console.log('Response status:', response.status);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((jsonData) => {
          console.log('Fetched data:', jsonData);

          if (!Array.isArray(jsonData)) {
            throw new Error('The fetched data is not an array.');
          }

          setData(jsonData); // Directly set the row-oriented data
        })
        .catch((error) => {
          console.error('Error fetching data:', error);
          setError('Failed to load data. Please check the file path or server.');
        });
  }, []);

  const racialOrder = [
    'White (Non-Hispanic)',
    'Black or African American',
    'Hispanic or Latino',
    'Other Race',
    'Asian',
    'Native Hawaiian and Pacific Islander',
    'American Indian and Alaskan Native',
  ];

  const racialOrderLegend = [
    'American Indian and Alaskan Native',
    'Native Hawaiian and Pacific Islander',
    'Asian',
    'Other Race',
    'Hispanic or Latino',
    'Black or African American',
    'White (Non-Hispanic)',
  ];

  // OG palette
  const colorPalette = [
    CONSTANTS.AIAN_COLOR,
    CONSTANTS.HIPI_COLOR,
    CONSTANTS.ASIA_COLOR,
    CONSTANTS.OTHER_RACE_COLOR,
    CONSTANTS.HISP_COLOR,
    CONSTANTS.BLACK_COLOR,
    CONSTANTS.WHITE_COLOR,
  ];

  const sortedData = data.sort(
      (a, b) =>
        racialOrder.indexOf(a.racial_group) - racialOrder.indexOf(b.racial_group),
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      const chart = Plot.plot({
        marks: [
          Plot.barY(sortedData, {
            x: 'total_criteria',
            y: 'percentage',
            fill: 'racial_group',
            tip: {
              format: {
                racial_group: (d) => d.replace(' and ', ' and<br>'),
                y: (d) => `${Math.round(d)}%`,
              },
            },
          }),
        ],
        y: {axis: true, label: 'Percentage', tickFormat: (d) => `${d}%`},
        x: {label: 'Indicator Thresholds Exceeded'},
        color: {
          range: colorPalette,
          legend: true,
          label: 'Race/Ethnicity',
          domain: racialOrderLegend,
        },
        marginBottom: 60,
        marginTop: 40,
        marginLeft: 60,
        style: {
          fontFamily: 'Lexend, sans-serif',
          fontSize: '18px',
        },
      });

      const container = document.getElementById('chart-container-2');
      if (container) {
        container.innerHTML = ''; // Clear any previous chart
        container.appendChild(chart);
        // Move the tooltip group to the end of the SVG so it always appears on top
        const svg = container.querySelector('svg');
        const tip = svg?.querySelector('g[aria-label="tip"]');
        if (tip && svg) svg.appendChild(tip);
      }

      // Animation on load
      const svg = d3.select(chart);
      const bars = svg.selectAll('rect');

      // Store original values
      bars.each((_, i, nodes) => {
        const bar = d3.select(nodes[i]);
        bar.attr('data-final-y', bar.attr('y'));
        bar.attr('data-final-height', bar.attr('height'));
      });

      // Start from base (y = chart height, height = 0)
      bars
          .attr('y', svg.node()?.getBoundingClientRect().height || 300)
          .attr('height', 0)
          .transition()
          .duration(600)
      // Stagger how the bars come up
          .delay((_, i) => i * 8)
          .attr('y', (_, i, nodes) => {
            return d3.select(nodes[i]).attr('data-final-y');
          })
          .attr('height', (_, i, nodes) => {
            return d3.select(nodes[i]).attr('data-final-height');
          });

      // Manually style legend because I couldn't get it to work inside observable
      // The text isn't contained inside p/text tag at all, it's inside a span
      const legendSpans = container?.querySelectorAll('span');
      legendSpans?.forEach((span) => {
        span.style.fontSize = '16px';
        span.style.display = 'inline-flex';
        span.style.alignItems = 'center';
        span.style.marginRight = '1em';
        span.style.gap = '0.4em';
        span.style.fontFamily = 'Lexend, sans-serif';

        // Set the dim for the little square
        const svg = span.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', '17');
          svg.setAttribute('height', '17');
        }
      });

      return () => chart.remove();
    }, 0); // Let the browser render layout first

    return () => clearTimeout(timeout);
  }, [sortedData]);

  if (error) {
    return <div style={{color: 'red'}}>{error}</div>;
  }

  if (sortedData.length === 0) {
    return <div>Loading Data...</div>;
  }

  return <div id="chart-container-2" />;
};

export default IndicatorDemGraph;
