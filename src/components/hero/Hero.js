import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import IMG_3221 from '../../images/IMG_3221.jpeg';
import IMG_3128 from '../../images/IMG_3128.jpeg';
import IMG_3490 from '../../images/IMG_3490.jpeg';
import IMG_3492 from '../../images/IMG_3492.jpeg';
import IMG_3546 from '../../images/IMG_3546.jpeg';
import IMG_3547 from '../../images/IMG_3547.jpeg';
import IMG_3550 from '../../images/IMG_3550.jpeg';
import IMG_3555 from '../../images/IMG_3555.jpeg';
import IMG_3558 from '../../images/IMG_3558.jpeg';
import logo from '../../torodilogo.svg';
import './Hero.css';

const Container = styled.div`
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
`;

const SlideImage = styled(motion.img)`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.6);
  will-change: opacity;
`;

const ContentWrapper = styled(motion.div)`
  z-index: 1;
  text-align: center;
  color: white;
  padding: clamp(1rem, 4vw, 2rem);
  width: 100%;
  max-width: 800px;
  margin-right: clamp(1rem, 4vw, 2rem);
  will-change: opacity;

  @media (max-width: 768px) {
    margin-right: 0;
    padding: clamp(0.5rem, 3vw, 1.5rem);
  }
`;

const Title = styled(motion.h1)`
  margin-bottom: clamp(0.5rem, 2vw, 1rem);
  letter-spacing: clamp(0.3px, 0.15vw, 0.75px);
  font-size: 60px;
  font-family: 'BiancoSans', sans-serif;
  font-weight: 300;
  text-align: right;
  padding-right: clamp(0.5rem, 2vw, 1rem);
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

  @media (max-width: 768px) {
    font-size: clamp(1rem, 5vw, 1.5rem);
    text-align: center;
    padding-right: 0;
  }
`;

const Subtitle = styled(motion.h2)`
  font-size: 20px;
  font-family: 'BiancoSans', sans-serif;
  font-weight: normal;
  text-align: right;
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  padding-right: clamp(0.5rem, 2vw, 1rem);
  line-height: 1.7;
  letter-spacing: 0.2px;

  @media (max-width: 768px) {
    font-size: clamp(0.75rem, 3vw, 0.9rem);
    text-align: center;
    padding-right: 0;
  }
`;

const Hero = () => {
  const [currentImage, setCurrentImage] = useState(0);
  const [nextImage, setNextImage] = useState(1);
  const images = [
    IMG_3128,
    IMG_3221,
    IMG_3490,
    IMG_3492,
    IMG_3546,
    IMG_3547,
    IMG_3550,
    IMG_3555,
    IMG_3558
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage(current => (current + 1) % images.length);
      setNextImage(next => (next + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <Container className="hero">
      <SlideImage
        key={`current-${currentImage}`}
        src={images[currentImage]}
        alt={`Slide ${currentImage + 1}`}
        style={{ position: 'absolute', opacity: 1 }}
        initial={false}
      />
      <SlideImage
        key={`next-${nextImage}`}
        src={images[nextImage]}
        alt={`Slide ${nextImage + 1}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      
      <ContentWrapper
        className="hero-content"
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <Title
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        >
          Welcome to Rodi Hotel
        </Title>
        <Subtitle
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        >
          Vibrant stays at the cozy rooms in Rovies
        </Subtitle>
      </ContentWrapper>
    </Container>
  );
};

export default Hero;
