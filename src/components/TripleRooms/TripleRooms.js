import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import BookingForm from '../BookingForm/BookingForm';
import './TripleRooms.css';

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

const TripleRoomsContainer = styled(motion.div)`
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

const tripleRoomVariants = {
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

const TripleRooms = () => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullScreenBooking, setShowFullScreenBooking] = useState(false);

  const handleBack = () => {
    navigate('/rooms');
  };

  const roomImages = [
    { color: '#CD5D67', alt: 'Triple Room Main View' },
    { color: '#D66C7A', alt: 'Triple Room Bedroom' },
    { color: '#E27B88', alt: 'Triple Room Bathroom' },
    { color: '#CD5D67', alt: 'Triple Room Living Area' },
    { color: '#D66C7A', alt: 'Triple Room Workspace' },
    { color: '#E27B88', alt: 'Triple Room View' },
  ];

  const roomDetails = {
    title: "Triple Room",
    size: "45 sq m",
    view: "City View",
    description: "Spacious and comfortable accommodation perfect for families or small groups. Features three single beds or one double and one single bed, all with premium COCO-MAT mattresses for ultimate comfort.",
    amenities: [
      "Three single beds or one double and one single bed",
      "Premium COCO-MAT mattresses",
      "Spacious wardrobe",
      "Work desk",
      "En-suite bathroom with shower",
      "Smart TV",
      "Mini fridge",
      "Air conditioning",
      "Safe deposit box",
      "High-speed Wi-Fi",
      "Premium toiletries"
    ]
  };

  return (
    <>
      <TripleRoomsContainer
        initial="hidden"
        animate="visible"
        variants={tripleRoomVariants}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="triple-room-container">
            <div className="triple-room-header">
              <BackButton onClick={handleBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back
              </BackButton>
              <h1>{roomDetails.title}</h1>
              <div className="triple-room-quick-info">
                <span>{roomDetails.size}</span>
                <span>{roomDetails.view}</span>
              </div>
            </div>

            <div className="triple-room-content">
              <div className="triple-room-gallery">
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

              <div className="triple-room-details">
                <div className="triple-room-description">
                  <p>{roomDetails.description}</p>
                </div>

                <div className="triple-room-amenities">
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
      </TripleRoomsContainer>

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
                roomCategory="Triple Room"
              />
            </div>
          </FullScreenOverlay>
        )}
      </AnimatePresence>
    </>
  );
};

export default TripleRooms; 