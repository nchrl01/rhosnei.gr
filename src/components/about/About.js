import React, { useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const AboutSection = styled.section`
  font-family: 'BiancoSans', sans-serif;
  padding: 2.5rem 1rem;
  background: #d66c7a;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (min-width: 768px) {
    padding: calc(60px + 2rem) clamp(20px, 5vw, 40px) 2rem;
  }

  @media (max-width: 768px) {
    padding: 2rem 1rem;
  }
`;

const Container = styled.div`
  max-width: 72rem;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;

  @media (min-width: 768px) {
    gap: 0.75rem;
  }

  @media (max-width: 768px) {
    margin: 1rem auto;
  }
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1rem;

  @media (min-width: 768px) {
    padding: 0;
  }
`;

const Title = styled(motion.h2)`
  font-family: 'BiancoSans', sans-serif;
  font-size: 60px;
  font-weight: 300;
  text-align: left;
  margin-bottom: 1.5rem;
  letter-spacing: clamp(0.3px, 0.15vw, 0.75px);
  max-width: 100%;

  @media (max-width: 768px) {
    font-size: clamp(1rem, 5vw, 1.5rem);
    text-align: center;
    margin-bottom: 1rem;
  }
`;

const Text = styled(motion.p)`
  font-family: 'BiancoSans', sans-serif;
  font-size: 20px;
  max-width: 800px;
  line-height: 1.7;
  text-align: left;
  letter-spacing: 0.2px;
  margin-bottom: 1rem;
  hyphens: auto;

  &:last-of-type {
    margin-bottom: 1.5rem;
  }

  @media (max-width: 768px) {
    font-size: clamp(0.75rem, 3vw, 0.9rem);
    text-align: center;
    margin-bottom: 0.75rem;
  }
`;

const ReadMoreButton = styled(motion.button)`
  font-family: 'BiancoSans', sans-serif;
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: 1px solid white;
  color: white;
  cursor: pointer;
  font-size: clamp(0.75rem, 3vw, 0.9rem);
  letter-spacing: 0.2px;
  transition: all 0.2s ease;
  margin-top: 0.5rem;

  &:hover {
    background: white;
    color: #d66c7a;
  }

  @media (max-width: 768px) {
    margin-top: 5px;
  }
`;

const About = () => {
  useEffect(() => {
    const handleScroll = () => {
      const heroElement = document.querySelector('.hero');
      
      if (heroElement && window.scrollY <= 550) {
        const height = 100 - (window.scrollY / 10);
        if (height >= 45) {
          heroElement.style.height = `${height}vh`;
          heroElement.style.transition = 'none';
        }
      }
    };
    
    document.documentElement.style.scrollBehavior = 'auto';
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  return (
    <AboutSection>
      <Container>
        <Content>
          <Title
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.2 }}
          >
            In complete harmony with the landscape.
          </Title>
          <Text
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            At Rodi boutique hotel, the harmonious blend of stone and wood, along with natural materials and earthy tones, creates a welcoming and serene atmosphere. Believing that true beauty lies in the details, we strive to ensure that every element of your stay reflects our dedication to warm hospitality and comfort, making your visit a truly memorable experience.
          </Text>
          <Text
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            Nestled in the heart of the village, just a few steps from the historic Venetian tower and only 50 meters from the sea, our guesthouse offers the perfect base to explore the region. Enjoy the tranquility and charm of Rovies while being within easy reach of its natural and cultural treasures.
          </Text>
          <Link to="/thehotel">
            <ReadMoreButton
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.2, delay: 0.2 }}
            >
              Read More
            </ReadMoreButton>
          </Link>
        </Content>
      </Container>
    </AboutSection>
  );
};

export default About;
