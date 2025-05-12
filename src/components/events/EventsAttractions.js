import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Section = styled.section`
  font-family: 'BiancoSans', sans-serif;
  padding: 3rem 1rem;
  color: white;
  background-color: #d66c7a;
  display: flex;
  align-items: flex-start;
  justify-content: center;

  @media (min-width: 768px) {
    padding: clamp(40px, 8vw, 80px) clamp(20px, 5vw, 40px);
  }

  @media (max-width: 768px) {
    padding: 2rem 1rem;
  }
`;

const Container = styled.div`
  max-width: 48rem;
  width: 100%;
  margin: 2rem auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 3rem;

  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 768px) {
    margin: 1rem auto;
    gap: 2rem;
  }
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.$isContent ? '1.25rem' : '0.5rem'};

  @media (max-width: 768px) {
    gap: ${props => props.$isContent ? '1rem' : '0.4rem'};
  }
`;

const Title = styled(motion.h2)`
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: normal;
  margin-bottom: 0.75rem;
  text-align: ${props => props.$align};

  @media (max-width: 768px) {
    font-size: clamp(1.2rem, 4vw, 1.5rem);
    text-align: center;
    margin-bottom: 0.5rem;
  }

  @media (max-width: 500px) {
    font-size: clamp(1rem, 3.5vw, 1.2rem);
  }
`;

const Description = styled(motion.p)`
  font-size: 0.9rem;
  line-height: 1.6;
  margin-bottom: 1rem;
  text-align: justify;
  color: rgba(255, 255, 255, 0.9);
  text-align-last: ${props => props.$align};
  ${props => props.$align === 'right' ? 'padding-left: 8%;' : ''}
  max-width: 800px;

  @media (max-width: 768px) {
    font-size: clamp(0.8rem, 3vw, 0.9rem);
    padding: 0;
    text-align-last: center;
    text-align: center;
    margin-bottom: 0.75rem;
  }

  @media (max-width: 500px) {
    font-size: clamp(0.75rem, 2.5vw, 0.8rem);
  }
`;

const Button = styled(motion.button)`
  font-family: 'BiancoSans', sans-serif;
  padding: clamp(6px, 1.2vw, 10px) clamp(12px, 2vw, 20px);
  background: transparent;
  border: 1px solid white;
  color: white;
  cursor: pointer;
  font-size: clamp(0.75rem, 1.8vw, 0.9rem);
  transition: all 0.2s ease;
  margin: ${props => props.$align === 'right' ? '0 0 0 auto' : '0 auto 0 0'};

  &:hover {
    background: white;
    color: #d66c7a;
  }

  @media (max-width: 768px) {
    margin: 0.75rem auto;
  }
`;

const Card = styled(motion.div)`
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  padding-bottom: ${props => props.$compact ? '0.4rem' : '0.5rem'};
  max-width: ${props => props.$isContent ? '100%' : '400px'};

  @media (max-width: 768px) {
    max-width: 100%;
    padding-bottom: 0.4rem;
  }
`;

const CardTitle = styled.h3`
  font-size: ${props => props.$compact ? 
    'clamp(0.8rem, 2vw, 0.9rem)' : 
    'clamp(0.85rem, 2.2vw, 0.9rem)'};
  font-weight: normal;
  margin-bottom: 0.25rem;

  @media (max-width: 500px) {
    font-size: clamp(0.7rem, 2vw, 0.75rem);
  }
`;

const SubText = styled.p`
  font-size: clamp(0.7rem, 1.6vw, 0.8rem);
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: ${props => props.$compact ? '0.4rem' : '0.5rem'};
`;

const DetailLink = styled.button`
  font-family: 'BiancoSans', sans-serif;
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  span:first-child {
    text-decoration: none;
  }

  &:hover span:first-child {
    text-decoration: underline;
  }

  &:hover span:last-child {
    transform: translateX(5px);
  }

  span:last-child {
    transition: transform 0.3s ease;
  }

  @media (max-width: 768px) {
    font-size: clamp(0.75rem, 2.5vw, 0.9rem);
  }
`;

const EventsAttractions = () => {
  const navigate = useNavigate();

  const handleNavigation = (id) => {
    navigate('/area', { state: { scrollTo: id } });
  };

  const handleSeeAll = (type) => {
    navigate('/area', { state: { filter: type } });
  };

  return (
    <Section>
      <Container>
        {/* Explore Rovies */}
        <Column $isContent>
          <Title
            $align="left"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Explore Rovies
          </Title>
          <Description
            $align="left"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Rovies are built in the arrow made by the two piney mountains Telethrio and Kavallaris, in a huge olive grove, which joins the foot of the mountain with the sea.
          </Description>
          <Button
            $align="left"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            onClick={() => handleSeeAll('attractions')}
          >
            See All Attractions
          </Button>
        </Column>

        {/* Suggestions */}
        <Column>
          {[
            { id: 'venetian-tower', title: 'Venetian Tower', distance: '0.2 kilometers away' },
            { id: 'rovies-beach', title: 'Rovies Beach', distance: '0.05 kilometers away' },
            { id: 'heracli-beach', title: 'Heracli Beach', distance: '0.3 kilometers away', compact: true },
            { id: 'kohili-beach', title: 'Kohili Beach', distance: '0.8 kilometers away', compact: true }
          ].map((item, index) => (
            <Card
              key={item.id}
              $compact={item.compact}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <CardTitle $compact={item.compact}>{item.title}</CardTitle>
              <SubText $compact={item.compact}>{item.distance}</SubText>
              <DetailLink onClick={() => handleNavigation(item.id)}>
                <span>See Details</span>
                <span>→</span>
              </DetailLink>
            </Card>
          ))}
        </Column>

        {/* Activities */}
        <Column $isContent>
          <Title
            $align="left"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Activities
          </Title>
          <Description
            $align="left"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            Since nature has dominant position throughout the region, you will have the chance to enjoy all kinds of activities. From mountain biking to horseback riding and windsurfing, the area simply offers ideal conditions.
          </Description>
          <Button
            $align="left"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            onClick={() => handleSeeAll('activities')}
          >
            View All Activities
          </Button>
        </Column>

        {/* Activities Suggestions */}
        <Column>
          {[
            { id: 'drymonas-xiron-trail', title: 'Hiking - Drymonas to Mount Xiron', duration: '3.5 hours • Moderate Difficulty', action: 'Explore Trail Details' },
            { id: 'horse-riding-centre', title: 'Horse Riding Centre Kamatriades', duration: 'Daily 9AM-Sunset • All Levels Welcome', action: 'Contact Center' },
            { id: 'sea-sports', title: 'Sea Sports in Rovies Bay', duration: 'Various Options • Perfect Conditions', action: 'View Activities', compact: true },
            { id: 'kohili-beach', title: 'Kohili Beach Water Sports', duration: 'Organized Beach • Equipment Available', action: 'View Details', compact: true }
          ].map((item, index) => (
            <Card
              key={item.id}
              $compact={item.compact}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <CardTitle $compact={item.compact}>{item.title}</CardTitle>
              <SubText $compact={item.compact}>{item.duration}</SubText>
              <DetailLink onClick={() => handleNavigation(item.id)}>
                <span>{item.action}</span>
                <span>→</span>
              </DetailLink>
            </Card>
          ))}
        </Column>
      </Container>
    </Section>
  );
};

export default EventsAttractions;