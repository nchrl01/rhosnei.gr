import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const SubmenuContainer = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: white;
  z-index: 2;
  display: flex;
  flex-direction: column;
`;

const BackButton = styled.button`
  position: sticky;
  top: 0;
  left: 0;
  background: white;
  border: none;
  cursor: pointer;
  padding: 1rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'BiancoSans', sans-serif;
  font-size: 0.9rem;
  width: 100%;
  z-index: 3;
  
  &:hover {
    color: #d66c7a;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const SubmenuContent = styled.div`
  padding: 1rem 2rem 2rem;
  flex: 1;
  overflow-y: auto;

  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(214, 108, 122, 0.3);
    border-radius: 2px;
    
    &:hover {
      background: rgba(214, 108, 122, 0.5);
    }
  }

  scrollbar-width: thin;
  scrollbar-color: rgba(214, 108, 122, 0.3) transparent;
`;

const Title = styled.h2`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.8rem, 2vw, 0.9rem);
  color: #d66c7a;
  margin-bottom: 1rem;
`;

const Description = styled.p`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  line-height: 1.5;
  color: #666;
  margin-bottom: 2rem;
  white-space: pre-line;

  /* Style sections with headers */
  strong {
    display: block;
    color: #d66c7a;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }

  /* Style bullet points */
  ul, ol {
    margin: 0.5rem 0;
    padding-left: 1.2rem;
  }

  li {
    margin-bottom: 0.3rem;
  }

  /* Add spacing between sections marked with \n\n */
  p + p {
    margin-top: 1rem;
  }
`;

const Categories = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 2rem;
`;

const CategoryTag = styled.span`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.65rem, 1.5vw, 0.75rem);
  padding: 4px 12px;
  background: rgba(214, 108, 122, 0.1);
  color: #d66c7a;
  border-radius: 12px;
`;

const PhoneLink = styled.a`
  color: #d66c7a;
  text-decoration: none;
  display: block;
  margin-top: 1rem;
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  
  &:hover {
    text-decoration: underline;
  }
`;

const WebsiteLink = styled.a`
  color: #d66c7a;
  text-decoration: none;
  display: block;
  margin-top: 0.5rem;
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  
  &:hover {
    text-decoration: underline;
  }
`;

const DirectionsLink = styled(WebsiteLink)`
  margin-top: 0.5rem;
`;

const AreaSubmenu = ({ attraction, isOpen, onClose }) => {
  const submenuVariants = {
    open: {
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    },
    closed: {
      x: "-100%",
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    }
  };

  if (!attraction) return null;

  const handleClose = () => {
    onClose();
  };

  // Hotel coordinates for directions
  const hotelCoordinates = [38.8090242, 23.2286358];
  const getDirectionsUrl = (coordinates) => {
    if (!coordinates) return null;
    return `https://www.google.com/maps/dir/${hotelCoordinates[0]},${hotelCoordinates[1]}/${coordinates[0]},${coordinates[1]}`;
  };

  return (
    <SubmenuContainer
      initial="closed"
      animate={isOpen ? "open" : "closed"}
      variants={submenuVariants}
    >
      <BackButton onClick={handleClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back
      </BackButton>
      <SubmenuContent>
        <Title>{attraction.title}</Title>
        <Description>{attraction.description}</Description>
        <Categories>
          {attraction.categories.map(category => (
            <CategoryTag key={category}>{category}</CategoryTag>
          ))}
        </Categories>
        {attraction.phoneNumber && (
          <PhoneLink href={`tel:${attraction.phoneNumber.replace(/\s/g, '')}`}>
            Tel: {attraction.phoneNumber}
          </PhoneLink>
        )}
        {attraction.website && (
          <WebsiteLink 
            href={`https://${attraction.website.replace(/^https?:\/\//, '')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {attraction.website}
          </WebsiteLink>
        )}
        {attraction.coordinates && (
          <DirectionsLink 
            href={getDirectionsUrl(attraction.coordinates)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get Directions from Hotel
          </DirectionsLink>
        )}
      </SubmenuContent>
    </SubmenuContainer>
  );
};

export default AreaSubmenu; 