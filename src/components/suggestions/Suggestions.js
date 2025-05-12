import React from 'react';
import styled from 'styled-components';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const StyledSuggestions = styled.section`
  background-color: #f9f6f3;
  color: #666;
  padding: 3rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;

  .suggestions__content {
    display: flex;
    max-width: 48rem;
    width: 100%;
    margin: 0 auto;
    justify-content: center;
    align-items: center;
  }

  .suggestions__section {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
`;

const AnimatedText = styled(motion.p)`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  font-weight: normal;
  letter-spacing: 0.3px;
  line-height: 1.5;
  text-align: center;
  margin: 0;

  a {
    color: #d66c7a;
    text-decoration: none;
    transition: all 0.2s ease;

    &:hover {
      color: #cd5d67;
      text-decoration: underline;
    }
  }
`;

const Suggestions = () => {
  const location = useLocation();
  
  // Only render on homepage and area page
  if (location.pathname !== '/' && location.pathname !== '/area') {
    return null;
  }

  return (
    <StyledSuggestions>
      <div className="suggestions__content">
        <div className="suggestions__section">
          <AnimatedText
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            A three-day suggested plan in order to explore the area and enjoy its beauties, 
            having as a base of course the Rodi – Boutique Hotel! You can see the trip on{' '}
            <a 
              href="http://www.wondergreece.gr/v1/en/Regions/Evia_Prefecture/Wonder_Suggestions/Suggested_plans_2/16922-3_beautiful_days_in_Rodi_boutique_hotel_exploring_North_Evia"
              target="_blank"
              rel="noopener noreferrer"
            >
              wondergreece.gr
            </a>
            , download it as it is or modify it to completely fit your desires.
          </AnimatedText>
        </div>
      </div>
    </StyledSuggestions>
  );
};

export default Suggestions; 