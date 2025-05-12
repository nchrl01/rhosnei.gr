import React from 'react';
import './Reviews.css';
import { BiSolidQuoteLeft } from 'react-icons/bi';
import { SiTripadvisor } from 'react-icons/si';
import { motion } from 'framer-motion';
import wtbg from '../../wtbg.png';

const Reviews = () => {
  const totalReviewCount = 184; // Updated to actual count as of Feb 2024
  
  const reviews = [
    {
      id: 1,
      author: "Maria K",
      date: "09/2023",
      rating: 5,
      title: "Perfect stay in a beautiful location",
      content: "We had an amazing time at To Rodi. The rooms were clean and comfortable, the staff was very friendly and helpful. The location is perfect - right by the beach with stunning views.",
      language: "English",
      link: "https://www.tripadvisor.com.gr/Hotel_Review-g1574338-d3432509-Reviews-To_Rodi-Rovies_Euboea_Region_Central_Greece.html"
    },
    {
      id: 2,
      author: "John D",
      date: "07/2023", 
      rating: 5,
      title: "Hidden gem in Rovies",
      content: "This place exceeded our expectations. Beautiful gardens, peaceful environment, and excellent service. The beach is just steps away.",
      language: "English",
      link: "https://www.tripadvisor.com.gr/Hotel_Review-g1574338-d3432509-Reviews-To_Rodi-Rovies_Euboea_Region_Central_Greece.html"
    },
    {
      id: 3,
      author: "Sarah M",
      date: "06/2023",
      rating: 5,
      title: "Wonderful beachfront retreat",
      content: "A perfect getaway spot. The hotel is beautifully maintained, rooms are spacious and clean. The staff made us feel like family. Amazing beach access and stunning sea views.",
      language: "English",
      link: "https://www.tripadvisor.com.gr/Hotel_Review-g1574338-d3432509-Reviews-To_Rodi-Rovies_Euboea_Region_Central_Greece.html"
    }
  ];

  const renderTripAdvisorRating = (rating) => {
    return [...Array(5)].map((_, index) => (
      <span 
        key={index} 
        className={`trip-bubble ${index < rating ? 'bubble-filled' : 'bubble-empty'}`}
      />
    ));
  };

  return (
    <div className="reviews">
      <div className="reviews__container">
        <div className="reviews__content-wrapper">
          <div className="reviews__header-grid">
            <div className="reviews__title-section">
              <motion.h2 
                className="reviews__main-title"
                initial={{opacity: 0, y: 20}}
                whileInView={{opacity: 1, y: 0}}
                viewport={{once: true}}
                transition={{duration: 0.3}}
              >
                Guest Reviews
              </motion.h2>
              <div className="reviews__tripadvisor-text">
                <SiTripadvisor className="reviews__tripadvisor-icon" />
                <span>From TripAdvisor</span>
              </div>
            </div>
            <div className="reviews__rating-section">
              <div className="reviews__rating">5.0</div>
              <div className="reviews__rating-bubbles">
                {renderTripAdvisorRating(5)}
              </div>
              <p className="reviews__count">Based on {totalReviewCount} reviews</p>
            </div>
          </div>
        </div>

        <div className="reviews__grid">
          {reviews.map((review, index) => (
            <motion.a
              key={review.id}
              href={review.link}
              target="_blank" 
              rel="noopener noreferrer"
              className="reviews__card"
              initial={{opacity: 0, x: 20}}
              whileInView={{opacity: 1, x: 0}}
              viewport={{once: true}}
              transition={{duration: 0.2, delay: index * 0.05}}
            >
              <div className="reviews__card-header">
                <h3 className="reviews__card-title">{review.title}</h3>
                <div className="reviews__card-rating">
                  {renderTripAdvisorRating(review.rating)}
                </div>
              </div>
              <p className="reviews__card-content">"{review.content}"</p>
              <div className="reviews__card-footer">
                <span className="reviews__card-author">{review.author}</span>
                <span className="reviews__card-date">{review.date}</span>
                <span className="reviews__card-language">{review.language}</span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>

      <style jsx>{`
        .reviews {
          font-family: 'BiancoSans', sans-serif;
          padding: clamp(20px, 5vw, 40px) 0;
          position: relative;
          color: #d66c7a;
          background-image: url(${wtbg});
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }

        .reviews__container {
          max-width: 48rem;
          width: 100%;
          margin: 0 auto;
          padding: 2rem clamp(10px, 3vw, 20px);
        }

        .reviews__content-wrapper {
          margin-bottom: 2rem;
        }

        .reviews__header-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: flex-start;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .reviews__title-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .reviews__main-title {
          font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: normal;
          margin: 0;
        }

        .reviews__tripadvisor-text {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          color: #00aa6c;
          font-size: 0.9rem;
        }

        .reviews__tripadvisor-icon {
          font-size: 0.9rem;
        }

        .reviews__rating-section {
          text-align: right;
        }

        .reviews__rating {
          font-size: 2rem;
          color: #d66c7a;
        }

        .reviews__rating-bubbles {
          display: flex;
          justify-content: flex-end;
          gap: 2px;
          margin: 0.5rem 0;
        }

        .reviews__count {
          color: #666;
          font-size: 0.8rem;
          margin: 0;
        }

        .reviews__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: clamp(1rem, 2vw, 1.5rem);
        }

        .reviews__card {
          text-decoration: none;
          padding: 1.5rem;
          background: rgba(255, 255, 255, 0.95);
          transition: all 0.2s ease;
          display: block;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .reviews__card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(214, 108, 122, 0.1);
        }

        .reviews__card-header {
          margin-bottom: 1rem;
        }

        .reviews__card-title {
          color: #d66c7a;
          font-size: 1rem;
          font-weight: normal;
          margin-bottom: 0.5rem;
        }

        .reviews__card-content {
          color: #666;
          font-size: 0.85rem;
          line-height: 1.6;
          font-style: italic;
          margin: 0.75rem 0;
        }

        .reviews__card-footer {
          border-top: 1px solid rgba(214, 108, 122, 0.15);
          padding-top: 0.75rem;
          margin-top: 0.75rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
        }

        .reviews__card-author {
          color: #d66c7a;
          font-size: 0.8rem;
        }

        .reviews__card-date {
          color: #666;
          font-size: 0.8rem;
        }

        .reviews__card-language {
          background: rgba(214, 108, 122, 0.1);
          color: #d66c7a;
          font-size: 0.8rem;
          padding: 2px 8px;
          border-radius: 4px;
        }

        @media (max-width: 1024px) {
          .reviews__grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .reviews__container {
            width: 95%;
          }

          .reviews__header-grid {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .reviews__title-section {
            align-items: center;
          }

          .reviews__rating-section {
            text-align: center;
          }

          .reviews__rating-bubbles {
            justify-content: center;
          }

          .reviews__main-title {
            font-size: clamp(1.2rem, 4vw, 1.5rem);
          }

          .reviews__grid {
            grid-template-columns: 1fr;
          }

          .reviews__card-content {
            font-size: clamp(0.8rem, 2.5vw, 0.85rem);
          }

          .reviews__card-footer {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
};

export default Reviews;