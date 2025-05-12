import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const HeaderSection = styled.section`
  font-family: 'BiancoSans', sans-serif;
  padding: calc(60px + 1.5rem) 0.75rem 1.5rem;
  background-color: #d66c7a;
  color: white;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  transition: all 0.3s ease;

  @media (min-width: 768px) {
    padding: calc(60px + 2rem) 1.5rem 2rem;
  }
`;

const Container = styled.div`
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
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

const Rooms2Header = () => {
  return (
    <HeaderSection>
      <Container>
        <Title {...commonAnimation}>
          Rooms & Suites
        </Title>
        <Subtitle {...commonAnimation}>
          We have carefully prepared a selection of inviting spaces designed for comfort and relaxation. Each room is thoughtfully decorated with soft colors, elegant furnishings, and delicate fabrics to create a warm and welcoming atmosphere. Whether seeking a cozy retreat or a more spacious setting, every detail has been chosen to ensure a serene and enjoyable stay.
        </Subtitle>
      </Container>
    </HeaderSection>
  );
};

export default Rooms2Header; 