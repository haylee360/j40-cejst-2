/* eslint-disable max-len */
import React from 'react';
import {defineMessages} from 'react-intl';
import {FormattedDate, FormattedMessage} from 'gatsby-plugin-intl';
import * as COMMON_COPY from './common';
import {CONTACT_SURVEY_LINKS} from '../constants';

export const PAGE_INTRO = defineMessages({
  PAGE_TILE: {
    id: 'contact.page.title.text',
    defaultMessage: 'Contact',
    description:
      'Navigate to the contact page, this is the contact page title text',
  },
  PAGE_HEADING: {
    id: 'contact.page.header.text',
    defaultMessage: 'Contact',
    description:
      'Navigate to the contact page, this is the contact page header text',
  },
  PAGE_SUB_HEADING: {
    id: 'contact.page.sub.header.text',
    defaultMessage: 'Contact us',
    description:
      'Navigate to the contact page, this is the contact page sub header text',
  },
  SURVEY_TEXT: {
    id: 'contact.page.fab.survey.text',
    defaultMessage: `Help improve the tool`,
    description:
      'Navigate to the contact page, this is the text for floating action button',
  },
});

export const RFI_BOX = defineMessages({
  TITLE: {
    id: 'contact.page.request.for.info.box.title',
    defaultMessage: 'Request for Information',
    description:
      'Navigate to the contact page, this is the title of the request for information box',
  },
});

export const RFI_BOX_BODY = (
  <FormattedMessage
    id={'contact.page.request.for.info.box.body'}
    defaultMessage={`The Request for Information on the Federal Register for the public beta period closed on {rfiExpDate}.`}
    description={
      'Navigate to the contact page, this is the body of the request for information box'
    }
    values={{
      rfiExpDate: (
        <FormattedDate
          value={COMMON_COPY.RFI_EXPIRATION_DATE}
          year="numeric"
          month="long"
          day="numeric"
        />
      ),
    }}
  />
);

export const CENSUS_TRACT_FEEDBACK = {
  // TITLE: <FormattedMessage
  //   id={'contact.page.census.tract.feedback.title'}
  //   defaultMessage={`Census tract feedback`}
  //   description={'Navigate to the contact page, this is the census tract feedback section'}
  // />,
  // PARAGRAPH1: <FormattedMessage
  //   id={'contact.page.census.tract.feedback.para1'}
  //   defaultMessage={`
  //     To provide feedback about a specific census tract, either select the send feedback button after
  //     selecting a census tract on the <link1>Explore the map</link1> page or use the email address provided above. Please include the census tract ID, county, and state or territory information, in addition to your feedback.
  //   `}
  //   description={'Navigate to the contact page, this is the census tract feedback section'}
  //   values={{
  //     link1: COMMON_COPY.linkFn(PAGES_ENDPOINTS.EXPLORE, true, false),
  //   }}
  // />,
  // PARAGRAPH2: <FormattedMessage
  //   id={'contact.page.census.tract.feedback.para2'}
  //   defaultMessage={`
  //     If there are specific data indicators that could be improved or changed, please include that
  //     information in the body of the email.
  //   `}
  //   description={'Navigate to the contact page, this is the census tract feedback section'}
  // />,
  PARAGRAPH3: (
    <FormattedMessage
      id={'contact.page.census.tract.feedback.para3'}
      defaultMessage={`
      The best way to contact the MEDS Justice40 team is to email us at the link below. If you wish to get in touch with the original developers at the Council on Environmental Quality (CEQ), you may fill out <link1>this form</link1>.
    `}
      description={
        'Navigate to the survey. Spanish should substitute <link2> to get Spanish link! Already coded to support'
      }
      values={{
        link1: COMMON_COPY.linkFn(CONTACT_SURVEY_LINKS.EN, false, true),
        link1es: COMMON_COPY.linkFn(CONTACT_SURVEY_LINKS.ES, false, true),
      }}
    />
  ),
};
