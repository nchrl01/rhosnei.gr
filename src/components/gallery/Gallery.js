import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const GallerySection = styled.section`
  padding: 3rem 0;
  position: relative;
  background-color: #fff;
  font-family: 'BiancoSans', sans-serif;
`;

const Container = styled.div`
  width: 100%;
  margin: 2rem auto;
  
  @media (max-width: 768px) {
    margin: 1rem auto;
  }
`;

const ContentWrapper = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 0 clamp(10px, 3vw, 20px);
  margin-bottom: 2rem;
`;

const Header = styled.div`
`;

const MainTitle = styled(motion.h2)`
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: normal;
  text-align: left;
  color: #d66c7a;
  margin: 0;
  
  @media (max-width: 768px) {
    text-align: center;
  }
`;

const GalleryWrapper = styled.div`
  width: 100%;
  padding: 0;
  overflow: hidden;
`;

const GalleryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 1rem;
  padding: 0 clamp(10px, 3vw, 20px);
  width: 100%;
  
  @media (max-width: 1200px) {
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }
  
  @media (max-width: 992px) {
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(4, 1fr);
  }
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(5, 1fr);
  }
  
  @media (max-width: 576px) {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(5, 1fr);
  }
`;

const GalleryItem = styled(motion.div)`
  position: relative;
  height: 250px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  
  @media (max-width: 992px) {
    height: 200px;
  }
  
  @media (max-width: 576px) {
    height: 180px;
  }
`;

const GalleryPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-family: 'BiancoSans', sans-serif;
  font-size: 1.2rem;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
  transition: transform 0.3s ease;
  
  &:hover {
    transform: scale(1.05);
  }
  
  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const ViewAllContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 0 clamp(10px, 3vw, 20px);
  margin-top: 1.5rem;
`;

const ViewAllLink = styled(Link)`
  background: none;
  border: none;
  color: #d66c7a;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  text-decoration: none;
  font-family: 'BiancoSans', sans-serif;
  
  &:hover span:first-child {
    text-decoration: underline;
  }

  .arrow {
    transition: transform 0.3s ease;
  }

  &:hover .arrow {
    transform: translateX(5px);
  }
`;

const Gallery = () => {
  // Create placeholder images with different colors - expanded to 10 for a 5x2 grid
  const placeholders = [
    { color: '#d66c7a', alt: 'Hotel Exterior' },
    { color: '#CD5D67', alt: 'Lobby' },
    { color: '#E27D60', alt: 'Restaurant' },
    { color: '#85CDCA', alt: 'Suite Room' },
    { color: '#E8A87C', alt: 'Double Room' },
    { color: '#C38D9E', alt: 'Triple Room' },
    { color: '#41B3A3', alt: 'Balcony View' },
    { color: '#8E9AAF', alt: 'Breakfast Area' },
    { color: '#D8A47F', alt: 'Hotel Garden' },
    { color: '#9A8194', alt: 'Reception' }
  ];

  return (
    <GallerySection>
      <Container>
        <ContentWrapper>
          <Header>
            <MainTitle
              initial={{opacity: 0, y: 20}}
              whileInView={{opacity: 1, y: 0}}
              viewport={{once: true}}
              transition={{duration: 0.3}}
            >
              Gallery
            </MainTitle>
          </Header>
        </ContentWrapper>
        
        <GalleryWrapper>
          <GalleryGrid>
            {placeholders.map((placeholder, index) => (
              <GalleryItem 
                key={index}
                initial={{opacity: 0, x: 20}}
                whileInView={{opacity: 1, x: 0}}
                viewport={{once: true}}
                transition={{duration: 0.2, delay: index * 0.05}}
              >
                <GalleryPlaceholder 
                  style={{ backgroundColor: placeholder.color }}
                  aria-label={placeholder.alt}
                >
                  <span>{placeholder.alt}</span>
                </GalleryPlaceholder>
              </GalleryItem>
            ))}
          </GalleryGrid>
        </GalleryWrapper>
        
        <ViewAllContainer>
          <ViewAllLink to="/gallery">
            <span>View All Photos</span>
            <span className="arrow">→</span>
          </ViewAllLink>
        </ViewAllContainer>
      </Container>
    </GallerySection>
  );
};

export default Gallery;
