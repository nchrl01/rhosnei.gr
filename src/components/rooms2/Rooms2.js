import React, { useState } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { MdAccessible } from 'react-icons/md';
import './Rooms2.css';
import suite from '../../images/suite.jpeg';
import double from '../../images/double.jpeg';
import triple from '../../images/triple.jpeg';
import { IoIosArrowBack, IoIosArrowForward, IoIosArrowDown } from 'react-icons/io';
import Rooms2Header from './Rooms2Header';

// Add container and card variants for animations
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardVariants = {
  hidden: { 
    opacity: 0, 
    y: 20 
  },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  }
};

const Rooms = () => {
  const navigate = useNavigate();
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [isAccessible] = useState(false);
  const [expandedAmenities, setExpandedAmenities] = useState({});
  const [currentImageIndex, setCurrentImageIndex] = useState({});
  
  const rooms = [
    {
      id: 'suite-1',
      images: [
        suite,
        suite,
        suite,
      ],
      title: "Grand Suite",
      type: ["suite"],
      description: "Experience luxury in our exquisite suites offering breathtaking views and premium amenities.",
      route: "/suites",
      hasAccessible: false,
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
    },
    {
      id: 'double-1',
      images: [
        double,
        double,
        double,
      ],
      title: "Double Room",
      type: ["double"],
      description: "Perfect for couples or business travelers, our double rooms provide a comfortable and stylish retreat with all essential amenities.",
      route: "/double",
      hasAccessible: true,
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
    },
    {
      id: 'triple-1',
      images: [
        triple,
        triple,
        triple,
      ],
      title: "Triple Room",
      type: ["triple"],
      description: "Ideal for families or small groups, our triple rooms offer spacious comfort with three single beds or one double and one single bed.",
      route: "/triple",
      hasAccessible: false,
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
    }
  ];

  const toggleAmenities = (roomId, e) => {
    e.stopPropagation();
    setExpandedAmenities(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  const nextImage = (roomId, e) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => ({
      ...prev,
      [roomId]: ((prev[roomId] || 0) + 1) % rooms[0].images.length
    }));
  };

  const prevImage = (roomId, e) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => ({
      ...prev,
      [roomId]: ((prev[roomId] || 0) - 1 + rooms[0].images.length) % rooms[0].images.length
    }));
  };

  return (
    <>
      <Rooms2Header />
      
      <motion.div 
        className="rooms-grid"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {rooms.map((room, index) => (
          <motion.div 
            key={room.id}
            className="room-card"
            variants={cardVariants}
            id={room.hasAccessible ? 'accessible-room' : undefined}
            tabIndex={room.hasAccessible ? 0 : undefined}
          >
            <div className="room-image">
              <div 
                className="color-frame" 
                style={{ backgroundColor: '#f5f5f5' }}
              />
              <img 
                src={room.images[currentImageIndex[room.id] || 0]} 
                alt={room.title} 
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
              <div className="image-controls">
                <div className="image-dots">
                  {room.images.map((_, index) => (
                    <button
                      key={index}
                      className={`image-dot ${index === (currentImageIndex[room.id] || 0) ? 'active' : ''}`}
                      aria-label={`View image ${index + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(prev => ({...prev, [room.id]: index}));
                      }}
                    />
                  ))}
                </div>
                <div className="image-arrows">
                  <button 
                    className="image-arrow" 
                    aria-label="Previous image"
                    onClick={(e) => prevImage(room.id, e)}
                  >
                    <IoIosArrowBack size={24} />
                  </button>
                  <button 
                    className="image-arrow" 
                    aria-label="Next image"
                    onClick={(e) => nextImage(room.id, e)}
                  >
                    <IoIosArrowForward size={24} />
                  </button>
                </div>
              </div>
            </div>
            <div className="room-info">
              <div className="room-info-main">
                <h3>{room.title}</h3>
                <p>{room.description}</p>
              </div>
              
              {room.hasAccessible && (
                <div className="accessibility-badge">
                  <MdAccessible size={20} />
                  <span>Accessible Room Available</span>
                </div>
              )}
              
              <div className="room-info-amenities">
                <div className="amenities-wrapper">
                  <button 
                    className="amenities-trigger"
                    onClick={(e) => toggleAmenities(room.id, e)}
                    aria-expanded={expandedAmenities[room.id]}
                  >
                    <span>In-Room Amenities</span>
                    <IoIosArrowDown size={22} />
                  </button>
                  
                  <ul className={`amenities-list ${expandedAmenities[room.id] ? 'expanded' : ''}`}>
                    {room.amenities.map((amenity, index) => (
                      <li key={index}>{amenity}</li>
                    ))}
                  </ul>
                </div>
                <button 
                  className="view-details"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(room.route);
                  }}
                >
                  View Details
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </>
  );
};

export default Rooms;
