import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const HeaderSection = styled.section`
  font-family: 'BiancoSans', sans-serif;
  padding: calc(60px + 1.5rem) 0.75rem 0.75rem;
  background-color: #d66c7a;
  color: white;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  transition: all 0.3s ease;

  @media (min-width: 768px) {
    padding: calc(60px + 2rem) 1.5rem 1rem;
  }
`;

const Container = styled.div`
  max-width: calc(800px - 1.5rem);
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;

  @media (max-width: 768px) {
    max-width: calc(800px - 1.5rem);
    padding: 0 0.75rem;
  }
`;

const Title = styled(motion.h1)`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(1.125rem, 2.25vw, 1.5rem);
  font-weight: normal;
  margin: 0;
  text-align: center;
  color: white;
  width: 100%;
`;

const Subtitle = styled(motion.p)`
  font-family: 'BiancoSans', sans-serif;
  font-size: 0.675rem;
  margin: 0;
  text-align: center;
  color: white;
  width: 100%;
  line-height: 1.6;
  max-width: 540px;
  opacity: 0.9;

  @media (max-width: 768px) {
    font-size: clamp(0.6rem, 2.25vw, 0.675rem);
    padding: 0 1rem;
  }
`;

const commonAnimation = {
  initial: { opacity: 0, y: 15 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.15 }
};

const AreaHeader = () => {
  return (
    <HeaderSection>
      <Container>
        <Title {...commonAnimation}>
          Explore the Area and Its Activities
        </Title>
        <Subtitle {...commonAnimation}>
          Whether it's mountain biking, horseback riding, or windsurfing, the region provides perfect conditions for outdoor activities.
        </Subtitle>
      </Container>
    </HeaderSection>
  );
};

export default AreaHeader;