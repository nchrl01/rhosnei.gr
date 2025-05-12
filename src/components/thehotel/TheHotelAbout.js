import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

// Styled components
const AboutSection = styled.section`
  margin-top: 0;
  padding: calc(60px + 2rem) 1rem 3rem;
  background: #f5f1eb;
  font-family: 'BiancoSans', sans-serif;
  color: #d66c7a;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (min-width: 768px) {
    padding: calc(60px + 2rem) clamp(20px, 5vw, 40px) clamp(40px, 8vw, 80px);
  }

  @media (max-width: 768px) {
    padding: calc(60px + 1.5rem) 1rem 2rem;
  }
`;

const Container = styled.div`
  max-width: 72rem;
  width: 100%;
  margin: 2rem auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
  gap: 0.5rem;
  margin-bottom: 1rem;
  align-items: center;
  max-width: 800px;
  margin: 0 auto;

  @media (min-width: 768px) {
    gap: 0.5rem;
    margin-bottom: 0;
    flex: 1;
  }
`;

const Title = styled(motion.h2)`
  font-family: 'BiancoSans', sans-serif;
  font-size: 60px;
  font-weight: 300;
  text-align: left;
  margin-bottom: 30px;
  letter-spacing: clamp(0.3px, 0.15vw, 0.75px);
  max-width: 100%;
  color: #d66c7a;

  @media (max-width: 768px) {
    font-size: clamp(1rem, 5vw, 1.5rem);
    text-align: center;
    margin-bottom: 20px;
  }
`;

const Text = styled(motion.p)`
  font-family: 'BiancoSans', sans-serif;
  font-size: 20px;
  max-width: 800px;
  line-height: 1.7;
  text-align: left;
  letter-spacing: 0.2px;
  margin-bottom: 15px;
  color: #d66c7a;
  hyphens: auto;

  &:last-of-type {
    margin-bottom: 20px;
  }

  @media (min-width: 768px) {
    padding: 0;
  }

  @media (max-width: 768px) {
    font-size: clamp(0.75rem, 3vw, 0.9rem);
    padding: 0 20px;
    text-align: center;
    margin-bottom: 12px;
  }
`;

const ImagePlaceholder = styled(motion.div)`
  width: 100%;
  height: 400px;
  background: rgba(214, 108, 122, 0.1);
  margin: 2rem auto;
  border-radius: 4px;
  overflow: hidden;
  position: relative;

  &::after {
    content: 'Image placeholder';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #d66c7a;
    font-family: 'BiancoSans', sans-serif;
    font-size: clamp(0.9rem, 2vw, 1.1rem);
  }

  @media (max-width: 768px) {
    height: 300px;
    margin: 1.5rem auto;
  }
`;

const TheHotelAbout = () => {
  return (
    <AboutSection>
      <Container>
        <Content>
          <Title
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.15 }}
          >
            In complete harmony with the landscape.
          </Title>
          <Text
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.15, delay: 0.05 }}
          >
            At Rodi boutique hotel, the harmonious blend of stone and wood, along with natural materials and earthy tones, creates a welcoming and serene atmosphere. Believing that true beauty lies in the details, we strive to ensure that every element of your stay reflects our dedication to warm hospitality and comfort, making your visit a truly memorable experience.
          </Text>

          <ImagePlaceholder
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.15, delay: 0.1 }}
          />

          <Text
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.15, delay: 0.05 }}
          >
            Nestled in the heart of the village, just a few steps from the historic Venetian tower and only 50 meters from the sea, our guesthouse offers the perfect base to explore the region. Enjoy the tranquility and charm of Rovies while being within easy reach of its natural and cultural treasures.
          </Text>
          <Text
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.15, delay: 0.1 }}
          >
            The surrounding scenery is nothing short of spectacular. A sheltered bay with crystal-clear waters stretches beneath the lush green slopes of Mount Telethrio and Mount Kavallaris. Here, the trees extend to the water's edge, creating a picturesque coastal setting. As the sun sets over the sea, the sky transforms into a breathtaking canvas of vibrant colors, offering an unforgettable experience.
          </Text>

          <ImagePlaceholder
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.15, delay: 0.15 }}
          />

          <Text
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.15, delay: 0.15 }}
          >
            The heart and soul of Rodi is Evangelia, whose over 30 years of experience in hospitality—gained at the family-owned Hotel Alexandridi—ensures a warm and welcoming atmosphere. With her dedication to guest satisfaction, every visitor is treated like family, creating a truly unforgettable stay.
          </Text>
          <Text
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.15, delay: 0.2 }}
          >
            As the saying goes, "A great day starts with a great morning," and at Rodi, each day starts with a delicious and nourishing breakfast on our sunlit terrace. We prepare a homemade feast using only the finest local ingredients.
          </Text>
          <Text
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.15, delay: 0.25 }}
          >
            From indulging in a hearty Greek breakfast to sipping coffee or aperitifs by the fireplace, every moment at To Rodi boutique hotel is designed to be relaxing and enjoyable. Whether you're here to explore, unwind, or experience authentic Greek hospitality, we aim to make your stay extraordinary.
          </Text>
        </Content>
      </Container>
    </AboutSection>
  );
};

export default TheHotelAbout;