import './App.css';
import Header from './components/header/Header';
import Hero from './components/hero/Hero';
import About from './components/about/About';
import Rooms from './components/rooms1/Rooms';
import EventsAttractions from './components/events/EventsAttractions';
import Services from './components/services/Services';
import GettingHere from './components/getting-here/GettingHere';
import Reviews from './components/reviews/Reviews';
import Footer from './components/footer/Footer';
import Area from './components/area/Area';
import Contact from './components/contact us/Contact';
import Rooms2 from './components/rooms2/Rooms2';
import THEHOTEL from './components/thehotel/THEHOTEL';
import Gallery from './components/gallery/Gallery';
import FullGallery from './components/gallery/FullGallery';
import Suggestions from './components/suggestions/Suggestions';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import Loading from './components/loading/Loading';
import ScrollToTop from "./components/ScrollToTop";
import Suites from './components/Suites/Suites';
import DoubleRooms from './components/DoubleRooms/DoubleRooms';
import TripleRooms from './components/TripleRooms/TripleRooms';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time or use this with actual data fetching
    setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Shows loading screen for 2 seconds
  }, []);

  if (isLoading) {
    return <Loading fullScreen={true} />;
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="App" style={{ textAlign: 'left' }}>
        <Header />
        <Routes>
          <Route path="/" element={
            <>
              <Hero />
              <About />
              <Rooms />
              <EventsAttractions />
              <Services />
              <GettingHere />
              <Reviews />
              <Gallery />
            </>
          } />
          <Route path="/area" element={<Area />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/rooms" element={<Rooms2 />} />
          <Route path="/thehotel" element={<THEHOTEL />} />
          <Route path="/gallery" element={<FullGallery />} />
          <Route path="/suites" element={<Suites />} />
          <Route path="/double" element={<DoubleRooms />} />
          <Route path="/triple" element={<TripleRooms />} />
        </Routes>
        <Suggestions />
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
