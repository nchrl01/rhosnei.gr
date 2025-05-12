import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

const GalleryPageSection = styled.section`
  padding: 6rem 0 3rem;
  position: relative;
  background-color: #fff;
  font-family: 'BiancoSans', sans-serif;
  min-height: 100vh;
`;

const Container = styled.div`
  width: 100%;
  margin: 0 auto;
`;

const ContentWrapper = styled.div`
  max-width: 800px;
  margin: 0 auto 2rem;
  padding: 0 clamp(10px, 3vw, 20px);
`;

const Header = styled.div`
  margin-bottom: 1rem;
`;

const MainTitle = styled(motion.h1)`
  font-size: clamp(1.8rem, 3.5vw, 2.5rem);
  font-weight: normal;
  text-align: left;
  color: #d66c7a;
  margin: 0;
  
  @media (max-width: 768px) {
    text-align: center;
  }
`;

const CategoryTabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 2rem 0;
  
  @media (max-width: 768px) {
    justify-content: center;
  }
`;

const CategoryTab = styled.button`
  background: none;
  border: none;
  color: ${props => props.active ? '#d66c7a' : '#666'};
  font-family: 'BiancoSans', sans-serif;
  font-size: 1rem;
  padding: 0.5rem 0;
  cursor: pointer;
  position: relative;
  margin-right: 1.5rem;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: #d66c7a;
    opacity: ${props => props.active ? 1 : 0};
    transition: opacity 0.3s ease;
  }
  
  &:hover::after {
    opacity: 1;
  }
`;

const GalleryGrid = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  padding: 0 clamp(10px, 3vw, 20px);
  width: 100%;
  
  @media (max-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
  }
  
  @media (max-width: 992px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 576px) {
    grid-template-columns: repeat(1, 1fr);
  }
`;

const GalleryItem = styled(motion.div)`
  position: relative;
  height: 300px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  
  @media (max-width: 992px) {
    height: 250px;
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
`;

const LightboxOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
`;

const LightboxContent = styled(motion.div)`
  position: relative;
  max-width: 90%;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const LightboxImage = styled.div`
  width: 100%;
  height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-family: 'BiancoSans', sans-serif;
  font-size: 2rem;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
  background-color: ${props => props.color};
`;

const LightboxCaption = styled.div`
  color: white;
  font-family: 'BiancoSans', sans-serif;
  font-size: 1.2rem;
  margin-top: 1rem;
  text-align: center;
`;

const CloseButton = styled.button`
  position: absolute;
  top: -2rem;
  right: -2rem;
  background: none;
  border: none;
  color: white;
  font-size: 2rem;
  cursor: pointer;
`;

const NavButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: white;
  font-size: 2rem;
  cursor: pointer;
  z-index: 1001;
  
  &.prev {
    left: 1rem;
  }
  
  &.next {
    right: 1rem;
  }
`;

const FullGallery = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Categories
  const categories = [
    { id: 'all', name: 'All' },
    { id: 'exterior', name: 'Exterior' },
    { id: 'rooms', name: 'Rooms' },
    { id: 'amenities', name: 'Amenities' },
    { id: 'dining', name: 'Dining' }
  ];
  
  // Gallery items with categories
  const galleryItems = [
    { id: 1, color: '#d66c7a', alt: 'Hotel Exterior', category: 'exterior' },
    { id: 2, color: '#CD5D67', alt: 'Lobby', category: 'interior' },
    { id: 3, color: '#E27D60', alt: 'Restaurant', category: 'dining' },
    { id: 4, color: '#85CDCA', alt: 'Suite Room', category: 'rooms' },
    { id: 5, color: '#E8A87C', alt: 'Double Room', category: 'rooms' },
    { id: 6, color: '#C38D9E', alt: 'Triple Room', category: 'rooms' },
    { id: 7, color: '#41B3A3', alt: 'Balcony View', category: 'exterior' },
    { id: 8, color: '#8E9AAF', alt: 'Breakfast Area', category: 'dining' },
    { id: 9, color: '#D8A47F', alt: 'Hotel Garden', category: 'exterior' },
    { id: 10, color: '#9A8194', alt: 'Reception', category: 'interior' },
    { id: 11, color: '#7395AE', alt: 'Swimming Pool', category: 'amenities' },
    { id: 12, color: '#557A95', alt: 'Spa Area', category: 'amenities' },
    { id: 13, color: '#5D5C61', alt: 'Fitness Center', category: 'amenities' },
    { id: 14, color: '#938BA1', alt: 'Conference Room', category: 'amenities' },
    { id: 15, color: '#7A6563', alt: 'Bar', category: 'dining' },
    { id: 16, color: '#A5A5A5', alt: 'Terrace', category: 'exterior' }
  ];
  
  // Filter items based on active category
  const filteredItems = activeCategory === 'all' 
    ? galleryItems 
    : galleryItems.filter(item => item.category === activeCategory);
  
  const openLightbox = (item) => {
    setSelectedImage(item);
    document.body.style.overflow = 'hidden';
  };
  
  const closeLightbox = () => {
    setSelectedImage(null);
    document.body.style.overflow = 'auto';
  };
  
  const navigateLightbox = (direction) => {
    const currentIndex = galleryItems.findIndex(item => item.id === selectedImage.id);
    let newIndex;
    
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % galleryItems.length;
    } else {
      newIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
    }
    
    setSelectedImage(galleryItems[newIndex]);
  };
  
  return (
    <GalleryPageSection>
      <Container>
        <ContentWrapper>
          <Header>
            <MainTitle
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.5}}
            >
              Gallery
            </MainTitle>
          </Header>
          
          <CategoryTabs>
            {categories.map(category => (
              <CategoryTab 
                key={category.id}
                active={activeCategory === category.id}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.name}
              </CategoryTab>
            ))}
          </CategoryTabs>
        </ContentWrapper>
        
        <AnimatePresence mode="wait">
          <GalleryGrid
            key={activeCategory}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {filteredItems.map((item, index) => (
              <GalleryItem 
                key={item.id}
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.3, delay: index * 0.05}}
                onClick={() => openLightbox(item)}
              >
                <GalleryPlaceholder 
                  style={{ backgroundColor: item.color }}
                  aria-label={item.alt}
                >
                  <span>{item.alt}</span>
                </GalleryPlaceholder>
              </GalleryItem>
            ))}
          </GalleryGrid>
        </AnimatePresence>
      </Container>
      
      <AnimatePresence>
        {selectedImage && (
          <LightboxOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLightbox}
          >
            <LightboxContent
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <CloseButton onClick={closeLightbox}>×</CloseButton>
              <LightboxImage color={selectedImage.color}>
                <span>{selectedImage.alt}</span>
              </LightboxImage>
              <LightboxCaption>{selectedImage.alt}</LightboxCaption>
            </LightboxContent>
            <NavButton className="prev" onClick={() => navigateLightbox('prev')}>‹</NavButton>
            <NavButton className="next" onClick={() => navigateLightbox('next')}>›</NavButton>
          </LightboxOverlay>
        )}
      </AnimatePresence>
    </GalleryPageSection>
  );
};

export default FullGallery; 