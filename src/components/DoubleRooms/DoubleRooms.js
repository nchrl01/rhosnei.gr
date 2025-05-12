import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import BookingForm from '../BookingForm/BookingForm';
import './DoubleRooms.css';

const BackButton = styled.button`
  position: relative;
  background: white;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-bottom: 1rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'BiancoSans', sans-serif;
  font-size: 0.9rem;
  z-index: 3;
  
  &:hover {
    color: #d66c7a;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const DoubleRoomsContainer = styled(motion.div)`
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
`;

const BookNowButton = styled.button`
  font-family: 'BiancoSans', sans-serif;
  background: #d66c7a;
  border: none;
  color: white;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 2rem 0;
  width: 100%;
  max-width: 300px;

  &:hover {
    background: #c45c6a;
    transform: translateY(-2px);
  }
`;

const FullScreenOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #CD5D67;
  z-index: 1000;
  overflow-y: auto;
  padding: 2rem;
`;

const doubleRoomVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

const DoubleRooms = () => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullScreenBooking, setShowFullScreenBooking] = useState(false);

  const handleBack = () => {
    navigate('/rooms');
  };

  const roomImages = [
    { color: '#CD5D67', alt: 'Double Room Living Area' },
    { color: '#D66C7A', alt: 'Double Room Bedroom' },
    { color: '#E27B88', alt: 'Double Room Bathroom' },
    { color: '#CD5D67', alt: 'Double Room View' },
    { color: '#D66C7A', alt: 'Double Room Amenities' },
    { color: '#E27B88', alt: 'Double Room Workspace' },
  ];

  const roomDetails = {
    title: "Deluxe Double Room",
    size: "30 sq m",
    view: "City View",
    description: "Modern and comfortable double room with contemporary furnishings and city views. Perfect for couples or business travelers seeking a refined stay experience.",
    amenities: [
      "King-size bed",
      "Work desk",
      "Rain shower",
      "Smart TV",
      "Mini bar",
      "High-speed Wi-Fi",
      "Air conditioning",
      "Safe deposit box",
      "Coffee maker",
      "Premium toiletries"
    ]
  };

  return (
    <>
      <DoubleRoomsContainer
        initial="hidden"
        animate="visible"
        variants={doubleRoomVariants}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="double-room-container">
            <div className="double-room-header">
              <BackButton onClick={handleBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back
              </BackButton>
              <h1>{roomDetails.title}</h1>
              <div className="double-room-quick-info">
                <span>{roomDetails.size}</span>
                <span>{roomDetails.view}</span>
              </div>
            </div>

            <div className="double-room-content">
              <div className="double-room-gallery">
                <div className="gallery-main">
                  <div 
                    className="main-image"
                    style={{ backgroundColor: roomImages[currentImageIndex].color }}
                    aria-label={roomImages[currentImageIndex].alt}
                  />
                </div>
                <div className="gallery-grid">
                  {roomImages.map((image, index) => (
                    <div
                      key={index}
                      className={`gallery-thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                      style={{ backgroundColor: image.color }}
                      onClick={() => setCurrentImageIndex(index)}
                      aria-label={image.alt}
                    />
                  ))}
                </div>
              </div>

              <div className="double-room-details">
                <div className="double-room-description">
                  <p>{roomDetails.description}</p>
                </div>

                <div className="double-room-amenities">
                  <h2>Room Amenities</h2>
                  <ul>
                    {roomDetails.amenities.map((amenity, index) => (
                      <li key={index}>{amenity}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <BookNowButton onClick={() => setShowFullScreenBooking(true)}>
                    Book Now
                  </BookNowButton>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </DoubleRoomsContainer>

      <AnimatePresence>
        {showFullScreenBooking && (
          <FullScreenOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>
              <BookingForm 
                onClose={() => setShowFullScreenBooking(false)}
                roomCategory="Double Room"
              />
            </div>
          </FullScreenOverlay>
        )}
      </AnimatePresence>
    </>
  );
};

export default DoubleRooms; 