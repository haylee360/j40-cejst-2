import {
  Address,
  Logo,
  NavList,
} from '@trussworks/react-uswds';
import {useIntl} from 'gatsby-plugin-intl';
import React from 'react';

import {hyphenizeString} from '../../../cypress/integration/common/helpers';
import J40MainGridContainer from '../J40MainGridContainer';
import LinkTypeWrapper from '../LinkTypeWrapper';
// import SurveyButton from '../SurveyButton';

// @ts-ignore
import {GITHUB_LINK, GITHUB_LINK_ES} from '../../constants';
import {PAGES_ENDPOINTS} from '../../data/constants';
import * as ABOUT_COPY from '../../data/copy/about';
import * as COMMON_COPY from '../../data/copy/common';
// import whitehouseIcon from '../../images/eop-seal.svg';
import brenleafart from '../../images/bren-leaf-art.svg';


const J40Footer = () => {
  const intl = useIntl();

  const NAVLINKS = [
    [
      intl.formatMessage(COMMON_COPY.FOOTER.CONTACT),
      <Address
        className={'j40-footer-address'}
        key={'footeraddress'}
        size={'big'}
        items={[
          COMMON_COPY.FOOTER_CEQ_ADDRESS.NAME,
          COMMON_COPY.FOOTER_CEQ_ADDRESS.STREET,
          COMMON_COPY.FOOTER_CEQ_ADDRESS.CITY_STATE,
          COMMON_COPY.FOOTER_CEQ_ADDRESS.PHONE,
        ]}
      />,
    ],
    [
      intl.formatMessage(COMMON_COPY.FOOTER.MORE_INFO),
      <LinkTypeWrapper
        className={'footer-link-first-child'}
        linkText={intl.formatMessage(COMMON_COPY.FOOTER.FOIA)}
        internal={false}
        url={'https://www.whitehouse.gov/ceq/foia'}
        openUrlNewTab={true}
        key={'foialink'}
        dataCy={hyphenizeString(COMMON_COPY.FOOTER.FOIA.defaultMessage)}
      />,
      <LinkTypeWrapper
        linkText={intl.formatMessage(COMMON_COPY.FOOTER.PRIVACY)}
        internal={true}
        url={PAGES_ENDPOINTS.PRIVACY}
        openUrlNewTab={false}
        key={'privacylink'}
        dataCy={hyphenizeString(COMMON_COPY.FOOTER.PRIVACY.defaultMessage)}
      />,
      <LinkTypeWrapper
        linkText={intl.formatMessage(COMMON_COPY.FOOTER.FIND_CONTACT)}
        internal={false}
        url={intl.formatMessage(COMMON_COPY.FOOTER.FIND_CONTACT_LINK)}
        openUrlNewTab={true}
        key={'contactlink'}
        dataCy={hyphenizeString(COMMON_COPY.FOOTER.FIND_CONTACT.defaultMessage)}
      />,
    ],
    [
      intl.formatMessage(COMMON_COPY.FOOTER.CONTRIBUTE),
      <LinkTypeWrapper
        linkText={intl.formatMessage(COMMON_COPY.FOOTER.GITHUB_LINK_TEXT)}
        internal={false}
        url={intl.locale === 'es' ? GITHUB_LINK_ES : GITHUB_LINK}
        openUrlNewTab={true}
        className={'footer-link-first-child'}
        key={'contactlink'}
        dataCy={hyphenizeString(COMMON_COPY.FOOTER.GITHUB_LINK_TEXT.defaultMessage)}
        tag={intl.formatMessage(ABOUT_COPY.GET_INVOLVED.JOIN_OSC_LINK_TAG)}
      />,
    ],
  ];

  // see https://designsystem.digital.gov/components/footer/
  return (
    // we cannot use trussworks Footer because it doesn't layout correct
    // and there's no easy way to override. It comes down to the
    // `className="mobile-lg:grid-col-6 desktop:grid-col-3">` needs to be
    // `className="mobile-lg:grid-col-12 desktop:grid-col-4">` ugh.
    <footer className={'j40-footer'}>
      <div className="usa-footer__primary-section pb2" data-cy={`footer-primary-block`}>
        <J40MainGridContainer>
          <div className={'grid-row tablet-lg:grid-col4'}>
            {NAVLINKS.map((links, i) => (
              <div
                key={`linkSection-${i}`}
                className="mobile-lg:grid-col-12 desktop:grid-col-4">
                <NavSection links={links} />
              </div>
            ))}
          </div>
        </J40MainGridContainer>
      </div>

      <div className="usa-footer__secondary-section">
        <J40MainGridContainer>
          <Logo
            size="medium"
            key={'logoimg'}
            image={
              <img
                className={'usa-footer__logo-img'}
                src={brenleafart}
                alt={intl.formatMessage(COMMON_COPY.FOOTER.LOGO_ALT)}/>
            }
            heading={
              <div className={'j40-footer-ceq-font'}>
                {intl.formatMessage(COMMON_COPY.FOOTER.TITLE)}
              </div>
            }
          />
        </J40MainGridContainer>
      </div>
      {/* <SurveyButton /> */}
    </footer>
  );
};

const NavSection = ({
  links,
}: {
  links: React.ReactNode[]
}): React.ReactElement => {
  const [primaryLinkOrHeading, ...secondaryLinks] = links;
  return (
    <section>
      <div className="j40-h4">{primaryLinkOrHeading}</div>
      <NavList type="footerSecondary" items={secondaryLinks} />
    </section>
  );
};

export default J40Footer;
