import React from 'react';
import TheHotelAbout from '../../components/thehotel/TheHotelAbout';
import Activities from '../../components/activities/Activities';
import Services from '../../components/services/Services';
import Suggestions from '../../components/suggestions/Suggestions';

const THEHOTEL = () => {
  return (
    <>
      <TheHotelAbout />
      <Activities />
      <Services />
      <Suggestions />
    </>
  );
};

export default THEHOTEL; 