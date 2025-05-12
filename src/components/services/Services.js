import React from 'react';
import styled from 'styled-components';
import { FaWifi, FaParking, FaCoffee, FaShower, FaSnowflake, FaCloudsmith } from 'react-icons/fa';
import { MdBalcony, MdKingBed, MdSecurity, MdKitchen, MdTv, MdPhone } from 'react-icons/md';
import { BsScissors } from 'react-icons/bs';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const ServicesSection = styled.section`
  padding: 0;
  text-align: center;
`;

const Container = styled.div`
  max-width: 48rem;
  width: 100%;
  margin: 0 auto;
  padding: 0 clamp(10px, 3vw, 20px);
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const SubsectionTitle = styled.h3`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(1.2rem, 2.5vw, 1.5rem);
  text-align: center;
  margin: 2rem 0;
  color: #d66c7a;
  font-weight: normal;
  width: 100%;
`;

const ServicesGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: stretch;
  gap: 1.5rem;
  padding: 0 1rem;
  max-width: 72rem;
  margin: 0 auto;
  width: 100%;
  
  & > * {
    flex: 0 0 150px;
  }
  
  @media (max-width: 768px) {
    gap: 1rem;
    padding: 0 0.75rem;
    
    & > * {
      flex: 0 0 calc(33.333% - 0.75rem);
      min-width: 100px;
    }
  }
  
  @media (max-width: 480px) {
    gap: 0.75rem;
    padding: 0 0.5rem;
    
    & > * {
      flex: 0 0 calc(50% - 0.5rem);
    }
  }
`;

const RoomServicesGrid = styled(ServicesGrid)`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 800px;
  margin: 0 auto;
  
  & > * {
    flex: 0 0 calc(20% - 1.5rem);
    margin-bottom: 1rem;
  }
  
  @media (max-width: 768px) {
    & > * {
      flex: 0 0 calc(33.333% - 1rem);
    }
  }
  
  @media (max-width: 480px) {
    & > * {
      flex: 0 0 calc(50% - 0.75rem);
    }
  }
`;

const ServiceCard = styled(motion.div)`
  text-align: center;
  padding: 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  height: 100%;
`;

const IconWrapper = styled.div`
  font-size: 1.5rem;
  color: #d66c7a;
  margin-bottom: 0.75rem;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ServiceTitle = styled.h4`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
  color: #d66c7a;
  text-align: center;
  font-weight: normal;
  line-height: 1.4;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  min-height: 40px;
`;

const RoomsSection = styled.div`
  padding: 3rem 0 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  ${SubsectionTitle} {
    color: #d66c7a;
    margin-bottom: 1.5rem;
  }
  
  ${IconWrapper} {
    color: #d66c7a;
    margin-bottom: 0.5rem;
  }
  
  ${ServiceTitle} {
    color: #d66c7a;
    font-size: clamp(0.75rem, 1.6vw, 0.85rem);
  }
`;

const CocoMatText = styled.p`
  text-align: center;
  color: #666;
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.75rem, 1.6vw, 0.85rem);
  line-height: 1.4;
  margin: 2rem auto 0;
  max-width: 800px;
  padding-bottom: 2rem;
  border-bottom: 1px solid #ddd;
`;

const HotelAmenitiesSection = styled.div`
  background-color: #CD5D67;
  padding: 3rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  ${SubsectionTitle} {
    color: white;
  }
  
  ${IconWrapper} {
    color: white;
  }
  
  ${ServiceTitle} {
    color: white;
  }
`;

const AccessibilitySection = styled.div`
  padding: 0 0 3rem;
  background-color: white;
  text-align: center;
  
  ${SubsectionTitle} {
    color: #d66c7a;
    font-size: clamp(1.2rem, 2.5vw, 1.5rem);
    margin-top: 0;
    margin-bottom: 1.5rem;
  }
`;

const AccessibilityText = styled.p`
  text-align: center;
  max-width: 800px;
  margin: 0 auto 2rem;
  font-family: 'BiancoSans', sans-serif;
  line-height: 1.6;
  color: #666;
  font-size: clamp(0.75rem, 1.6vw, 0.85rem);
`;

const ViewRoomsLink = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #d66c7a;
  text-decoration: none;
  font-family: 'BiancoSans', sans-serif;
  margin: 2rem auto 0;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
  width: fit-content;
  
  span:first-child {
    text-decoration: none;
  }

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

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.25 }
};

const hotelAmenities = [
  {
    icon: <FaWifi />,
    title: 'WiFi'
  },
  {
    icon: <FaCoffee />,
    title: 'Breakfast'
  },
  {
    icon: <FaParking />,
    title: 'Parking'
  },
];

const roomAmenities = [
  {
    icon: <MdKingBed />,
    title: 'King Size Bed'
  },
  {
    icon: <FaShower />,
    title: 'Shower'
  },
  {
    icon: <MdSecurity />,
    title: 'Safety Box'
  },
  {
    icon: <MdKitchen />,
    title: 'Mini Fridge'
  },
  {
    icon: <MdTv />,
    title: 'Television'
  },
  {
    icon: <MdPhone />,
    title: 'Communication & Fax'
  },
  {
    icon: <BsScissors />,
    title: 'Hair Dryer'
  },
  {
    icon: <MdBalcony />,
    title: 'Balcony'
  },
  {
    icon: <FaSnowflake />,
    title: 'Individual AC & Central Heating'
  },
  {
    icon: <FaCloudsmith />,
    title: 'Bathrobes & Slippers'
  }
];

const Services = () => {
  const navigate = useNavigate();

  const handleAccessibilityClick = (e) => {
    e.preventDefault();
    navigate('/rooms');
    setTimeout(() => {
      const accessibleRoom = document.getElementById('accessible-room');
      if (accessibleRoom) {
        accessibleRoom.scrollIntoView({ behavior: 'smooth' });
        accessibleRoom.focus();
      }
    }, 100);
  };

  return (
    <ServicesSection>
      <HotelAmenitiesSection>
        <Container>
          <SubsectionTitle
            as={motion.h3}
            {...fadeInUp}
          >
            Hotel Amenities
          </SubsectionTitle>
          <ServicesGrid>
            {hotelAmenities.map((service, index) => (
              <ServiceCard 
                key={index}
                {...fadeInUp}
                transition={{ duration: 0.25, delay: index * 0.05 }}
              >
                <IconWrapper aria-hidden="true">
                  {service.icon}
                </IconWrapper>
                <ServiceTitle>{service.title}</ServiceTitle>
              </ServiceCard>
            ))}
          </ServicesGrid>
        </Container>
      </HotelAmenitiesSection>

      <RoomsSection>
        <Container>
          <SubsectionTitle
            as={motion.h3}
            {...fadeInUp}
          >
            All Rooms Include
          </SubsectionTitle>
          <RoomServicesGrid>
            {roomAmenities.map((service, index) => (
              <ServiceCard 
                key={index}
                {...fadeInUp}
                transition={{ duration: 0.25, delay: index * 0.05 }}
              >
                <IconWrapper aria-hidden="true">
                  {service.icon}
                </IconWrapper>
                <ServiceTitle>{service.title}</ServiceTitle>
              </ServiceCard>
            ))}
          </RoomServicesGrid>
          <CocoMatText
            as={motion.p}
            {...fadeInUp}
          >
            Enjoy the natural comfort of Coco-Mat in our beds, furnishings, and clothing.
          </CocoMatText>
        </Container>
      </RoomsSection>

      <AccessibilitySection>
        <Container>
          <SubsectionTitle
            as={motion.h3}
            {...fadeInUp}
          >
            Accessibility at Our Hotel
          </SubsectionTitle>
          <AccessibilityText
            as={motion.p}
            {...fadeInUp}
          >
            We are committed to providing equal access and opportunity for individuals with disabilities. 
            Our features also make this hotel more accessible for older individuals with changing abilities 
            to ensure a seamless experience. Our overall goal is to improve usability throughout the hotel for all guests.
          </AccessibilityText>
          <ViewRoomsLink 
            href="/rooms"
            as={motion.a}
            {...fadeInUp}
            onClick={handleAccessibilityClick}
          >
            <span>View Rooms with Accessibility Features</span>
            <span className="arrow">→</span>
          </ViewRoomsLink>
        </Container>
      </AccessibilitySection>
    </ServicesSection>
  );
};

export default Services;
