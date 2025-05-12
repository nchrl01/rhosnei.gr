import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import BookingForm from '../BookingForm/BookingForm';
import './Suites.css';

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

const SuitesContainer = styled(motion.div)`
  // ... existing styles
`;

const BookNowButton = styled.button`
  font-family: 'BiancoSans', sans-serif;
  background: transparent;
  border: 2px solid #d66c7a;
  color: #d66c7a;
  padding: 0.8rem;
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 2rem 0;
  width: 100%;
  max-width: 300px;

  &:hover {
    background: #d66c7a;
    color: white;
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

const suiteVariants = {
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

const Suites = () => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullScreenBooking, setShowFullScreenBooking] = useState(false);

  const handleBack = () => {
    navigate('/rooms');
  };

  const suiteImages = [
    { color: '#CD5D67', alt: 'Suite Living Area' },
    { color: '#D66C7A', alt: 'Suite Bedroom' },
    { color: '#E27B88', alt: 'Suite Bathroom' },
    { color: '#CD5D67', alt: 'Suite Dining Area' },
    { color: '#D66C7A', alt: 'Suite Kitchen' },
    { color: '#E27B88', alt: 'Suite Balcony' },
    { color: '#CD5D67', alt: 'Suite Master Bathroom' },
    { color: '#D66C7A', alt: 'Suite Office Space' },
    { color: '#E27B88', alt: 'Suite Evening View' },
  ];

  const suiteDetails = {
    title: "Two Level Suite",
    size: "193 sq m",
    view: "City View",
    description: "Luxurious two-level suite with breathtaking vista of Acropolis and Lycabettus Hill. Experience unparalleled comfort in our signature accommodation featuring premium COCO-MAT beds and furnishings.",
    amenities: [
      "King-size anatomic COCO-MAT beds",
      "COCO-MAT clothing and furnishings",
      "Bathrobes and slippers",
      "Hairdryer",
      "Safety box",
      "Central heating",
      "Individually controlled air conditioning",
      "Mini fridge and minibar",
      "LCD TV",
      "Telephone and fax",
      "Wi-Fi access"
    ]
  };

  return (
    <>
      <SuitesContainer
        initial="hidden"
        animate="visible"
        variants={suiteVariants}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="suite-container">
            <div className="suite-header">
              <BackButton onClick={handleBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back
              </BackButton>
              <h1>{suiteDetails.title}</h1>
              <div className="suite-quick-info">
                <span>{suiteDetails.size}</span>
                <span>{suiteDetails.view}</span>
              </div>
            </div>

            <div className="suite-content">
              <div className="suite-gallery">
                <div className="gallery-main">
                  <div 
                    className="main-image"
                    style={{ backgroundColor: suiteImages[currentImageIndex].color }}
                    aria-label={suiteImages[currentImageIndex].alt}
                  />
                </div>
                <div className="gallery-grid">
                  {suiteImages.map((image, index) => (
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

              <div className="suite-details">
                <div className="suite-description">
                  <p>{suiteDetails.description}</p>
                </div>

                <div className="suite-amenities">
                  <h2>Room Amenities</h2>
                  <ul>
                    {suiteDetails.amenities.map((amenity, index) => (
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
      </SuitesContainer>

      <AnimatePresence>
        {showFullScreenBooking && (
          <FullScreenOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>
              <BookingForm onClose={() => setShowFullScreenBooking(false)} />
            </div>
          </FullScreenOverlay>
        )}
      </AnimatePresence>
    </>
  );
};

export default Suites; 