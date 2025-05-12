import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import wtbg from '../../wtbg.png';
import './Rooms.css';
import suite from '../../images/suite.jpeg';
import double from '../../images/double.jpeg';
import triple from '../../images/triple.jpeg';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const Rooms = () => {
  const sliderRef = useRef(null);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('SUITES');
  
  const allRooms = [
    // SUITES
    {
      image: suite,
      title: "Junior Suite with 1 King Bed",
      type: "SUITES"
    },
    {
      image: double,
      title: "Grand Suite",
      type: "SUITES"
    },
    {
      image: triple,
      title: "Penthouse Suite",
      type: "SUITES"
    },
    // DOUBLES
    {
      image: double,
      title: "Premium Double Room",
      type: "DOUBLES"
    },
    {
      image: double,
      title: "Deluxe Double Room",
      type: "DOUBLES"
    },
    // TRIPLES
    {
      image: triple,
      title: "Family Triple Room",
      type: "TRIPLES"
    },
    {
      image: triple,
      title: "Superior Triple Room",
      type: "TRIPLES"
    }
  ];

  const handleTabClick = (tabType) => {
    setActiveTab(tabType);
    
    // Find the index of the first room of the selected type
    const firstRoomIndex = allRooms.findIndex(room => room.type === tabType);
    
    if (firstRoomIndex !== -1 && sliderRef.current) {
      // Get the slider container
      const sliderContainer = sliderRef.current.parentElement;
      
      if (sliderContainer) {
        // Get all cards
        const cards = sliderRef.current.children;
        
        // If we have enough cards
        if (cards.length > firstRoomIndex) {
          // Get the target card
          const targetCard = cards[firstRoomIndex];
          
          // Calculate the scroll position
          // We need to account for the container's left padding/margin
          const containerRect = sliderContainer.getBoundingClientRect();
          const targetRect = targetCard.getBoundingClientRect();
          
          // The scroll amount is the difference between the target's left edge
          // and the container's left edge, plus the current scroll position
          const scrollLeft = sliderContainer.scrollLeft + (targetRect.left - containerRect.left);
          
          // Scroll to the calculated position
          sliderContainer.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
          });
        }
      }
    }
  };

  return (
    <div className='rooms'>
      <div className="rooms__container">
        <div className="rooms__content-wrapper">
          <div className="rooms__header">
            <motion.h2 
              className="rooms__main-title"
              initial={{opacity: 0, y: 20}}
              whileInView={{opacity: 1, y: 0}}
              viewport={{once: true}}
              transition={{duration: 0.3}}
            >
              Rooms & Suites
            </motion.h2>
          </div>

          <motion.div 
            className="rooms__description"
            initial={{opacity: 0, y: 20}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true}}
            transition={{duration: 0.3}}
          >
            <p>Experience luxury and comfort in our elegantly designed rooms and suites. 
            Each space features contemporary décor, premium amenities, and stunning views. 
            Our accommodations blend modern sophistication with timeless elegance to create 
            the perfect retreat for both business and leisure travelers.</p>
          </motion.div>

          <div className="rooms__tabs-container">
            <div className="rooms__tabs">
              <button 
                className={`rooms__tab ${activeTab === 'SUITES' ? 'active' : ''}`}
                onClick={() => handleTabClick('SUITES')}
              >
                Suites
              </button>
              <button 
                className={`rooms__tab ${activeTab === 'DOUBLES' ? 'active' : ''}`}
                onClick={() => handleTabClick('DOUBLES')}
              >
                Doubles
              </button>
              <button 
                className={`rooms__tab ${activeTab === 'TRIPLES' ? 'active' : ''}`}
                onClick={() => handleTabClick('TRIPLES')}
              >
                Triples
              </button>
            </div>
            <button
              className="rooms__view-all"
              onClick={() => navigate('/rooms')}
            >
              <span>View More</span>
              <span className="rooms__view-all-arrow">→</span>
            </button>
          </div>
        </div>

        <div className="rooms__slider-wrapper">
          <div className="rooms__slider-container">
            <div className="rooms__slider" ref={sliderRef}>
              {allRooms.map((room, i) => (
                <motion.div 
                  key={i}
                  className="rooms__card"
                  initial={{opacity: 0, x: 20}}
                  whileInView={{opacity: 1, x: 0}}
                  viewport={{once: true}}
                  transition={{duration: 0.2, delay: i * 0.05}}
                >
                  <div 
                    className="rooms__image" 
                    style={{
                      backgroundImage: `url(${room.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                  <div className="rooms__content">
                    <h3 className="rooms__card-title">{room.title}</h3>
                    <button 
                      className="rooms__button rooms__button--details"
                      onClick={() => navigate('/rooms')}
                    >
                      View Details
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .rooms {
          font-family: 'BiancoSans', sans-serif;
          padding: 3rem 0;
          position: relative;
          color: #d66c7a;
          background-image: url(${wtbg});
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;

          @media (min-width: 768px) {
            padding: clamp(40px, 8vw, 80px) 0;
          }

          @media (max-width: 768px) {
            padding: 2rem 0;
          }
        }

        .rooms__container {
          width: 100%;
          margin: 2rem auto;

          @media (max-width: 768px) {
            margin: 1rem auto;
          }
        }

        .rooms__content-wrapper {
          max-width: 800px;
          margin: 0 auto;
          padding: 0 clamp(10px, 3vw, 20px);
        }

        .rooms__slider-wrapper {
          width: 100%;
          padding: 0;
          overflow: hidden;
        }

        .rooms__header {
          margin-bottom: 2rem;
        }

        .rooms__main-title {
          font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: normal;
          text-align: left;
          color: #d66c7a;
          margin: 0;
        }

        .rooms__description {
          margin: 1.5rem 0;
          text-align: left;
          color: #666;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .rooms__tabs-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .rooms__tabs {
          display: flex;
          gap: 1.5rem;
        }

        .rooms__view-all {
          background: none;
          border: none;
          color: #d66c7a;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0;
        }

        .rooms__view-all span:first-child {
          text-decoration: none;
        }

        .rooms__view-all:hover span:first-child {
          text-decoration: underline;
        }

        .rooms__view-all-arrow {
          transition: transform 0.3s ease;
        }

        .rooms__view-all:hover .rooms__view-all-arrow {
          transform: translateX(5px);
        }

        .rooms__tab {
          background: none;
          border: none;
          color: #666;
          font-size: 0.9rem;
          cursor: pointer;
          padding: 0.5rem 0;
          position: relative;
          text-align: left;
          transition: color 0.3s ease;
        }

        .rooms__tab:hover {
          color: #d66c7a;
        }

        .rooms__tab.active {
          color: #d66c7a;
        }

        .rooms__tab::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: #d66c7a;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .rooms__tab:hover::after {
          opacity: 1;
        }

        .rooms__tab.active::after {
          opacity: 1;
        }

        .rooms__slider-container {
          margin-top: 1rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
          width: 100%;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
        }

        .rooms__slider-container::-webkit-scrollbar {
          display: none;
        }

        .rooms__slider {
          display: flex;
          gap: 1.5rem;
          padding: 1rem 0;
          margin-left: calc((100% - 800px) / 4);
        }

        .rooms__card {
          min-width: 1000px;
          position: relative;
          cursor: pointer;
          overflow: visible;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .rooms__image {
          width: 100%;
          height: 667px;
          transition: transform 0.3s ease;
          overflow: hidden;
          position: relative;
          background-size: cover;
          background-position: center;
        }

        .rooms__card:hover .rooms__image {
          transform: scale(1.02);
        }

        .rooms__content {
          padding: 0.5rem 0;
          color: #d66c7a;
        }

        .rooms__card-title {
          font-size: 0.9rem;
          font-weight: normal;
          margin: 0;
          color: #d66c7a;
        }

        .rooms__button--details {
          display: none;
        }

        @media (max-width: 1200px) {
          .rooms__slider {
            margin-left: 5vw;
          }

          .rooms__card {
            min-width: 800px;
          }

          .rooms__image {
            height: 533px;
          }
        }

        @media (max-width: 768px) {
          .rooms__slider-wrapper {
            margin: 0;
            overflow: hidden;
          }

          .rooms__slider-container {
            margin-top: 0.5rem;
            padding: 0;
            overflow-x: auto;
          }

          .rooms__slider {
            padding-left: 1rem;
            margin-left: 0;
            gap: 1rem;
            padding-right: calc(1rem + 60px);
          }

          .rooms__card {
            min-width: calc(100vw - 3.5rem);
            height: auto;
            overflow: hidden;
            box-shadow: none;
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .rooms__image {
            height: calc(100vh - 300px);
            min-height: 600px;
            max-height: 800px;
            transition: transform 0.3s ease;
          }

          .rooms__main-title {
            font-size: clamp(1.2rem, 4vw, 1.5rem);
            text-align: center;
          }

          .rooms__description {
            font-size: clamp(0.8rem, 3vw, 0.9rem);
            margin: 1rem 0;
            text-align: center;
          }

          .rooms__tabs-container {
            margin-bottom: 0.25rem;
          }

          .rooms__tab {
            font-size: clamp(0.75rem, 2.5vw, 0.9rem);
          }

          .rooms__view-all {
            font-size: clamp(0.75rem, 2.5vw, 0.9rem);
          }
        }

        @media (max-width: 500px) {
          .rooms__card {
            min-width: calc(100vw - 3.5rem);
          }

          .rooms__image {
            height: calc(100vh - 250px);
            min-height: 500px;
            max-height: 700px;
          }

          .rooms__main-title {
            font-size: clamp(1rem, 3.5vw, 1.2rem);
            text-align: center;
          }

          .rooms__description {
            font-size: clamp(0.75rem, 2.5vw, 0.8rem);
            text-align: center;
          }

          .rooms__card-title {
            font-size: clamp(0.7rem, 2vw, 0.75rem);
          }

          .rooms__slider {
            padding-right: calc(1rem + 40px);
          }
        }
      `}</style>
    </div>
  );
};

const ActivitiesSection = styled.section`
  padding: calc(60px + 2rem) 1rem 2rem;
`;

const Container = styled.div`
  max-width: 48rem;
  width: 100%;
  margin: 0 auto;
  padding: 1rem;
  background: #e3edfa; // or your desired color
  border-radius: 8px;
`;

export default Rooms;
