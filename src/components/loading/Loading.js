import React from 'react';
import './Loading.css';
import crown from '../../crown.png';

const Loading = ({ fullScreen = false, size = '100px', backgroundColor }) => {
  return (
    <div className={`loading-container ${fullScreen ? 'fullscreen' : 'inline'}`}
         style={{ backgroundColor }}>
      <div className="loading-wrapper" style={{ width: size, height: size }}>
        <div className="spinning-circle">
          <img src={crown} alt="" className="crown-icon" />
          <div></div>
        </div>
      </div>
    </div>
  );
};

export default Loading;