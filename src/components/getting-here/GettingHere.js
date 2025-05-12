import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './GettingHere.css';

// Create custom marker icons
const createCustomIcon = (color) => new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 27 41">
      <path fill="${color}" stroke="#FFF" stroke-width="2" d="M13.5 1C6.6 1 1 6.6 1 13.5 1 26 13.5 40 13.5 40S26 26 26 13.5C26 6.6 20.4 1 13.5 1Z"/>
      <circle fill="#FFF" cx="13.5" cy="13.5" r="5.5"/>
    </svg>
  `)}`,
  iconSize: [27, 41],
  iconAnchor: [13.5, 41],
  popupAnchor: [0, -41],
  shadowUrl: 'data:image/png;base64,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',
  shadowSize: [41, 41],
  shadowAnchor: [13, 41]
});

// Create hotel icon - using the brand color
const hotelIcon = createCustomIcon('#d66c7a');

// Create airport icon - using gray color like in Area.js
const airportIcon = createCustomIcon('#666666');

// Create inverted icon for clicked pins
const createInvertedIcon = () => new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 27 41">
      <path fill="#FFFFFF" stroke="#d66c7a" stroke-width="2" d="M13.5 1C6.6 1 1 6.6 1 13.5 1 26 13.5 40 13.5 40S26 26 26 13.5C26 6.6 20.4 1 13.5 1Z"/>
      <circle fill="#d66c7a" cx="13.5" cy="13.5" r="5.5"/>
    </svg>
  `)}`,
  iconSize: [27, 41],
  iconAnchor: [13.5, 41],
  popupAnchor: [0, -41],
  shadowUrl: 'data:image/png;base64,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',
  shadowSize: [41, 41],
  shadowAnchor: [13, 41]
});

// Add this function to detect the operating system
const getOperatingSystem = () => {
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  
  if (macosPlatforms.indexOf(platform) !== -1) {
    return 'Mac';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    return 'Windows';
  } else if (/Linux/.test(platform)) {
    return 'Linux';
  } else if (/Android/.test(userAgent)) {
    return 'Android';
  } else if (/iPhone|iPad|iPod/.test(userAgent)) {
    return 'iOS';
  }
  
  return 'Unknown';
};

// Get the appropriate key symbol based on OS
const getModifierKeySymbol = () => {
  const os = getOperatingSystem();
  switch (os) {
    case 'Mac':
      return '⌘';
    case 'Windows':
      return 'Ctrl';
    case 'Linux':
      return 'Ctrl';
    case 'Android':
    case 'iOS':
      return 'two fingers';
    default:
      return 'Ctrl';
  }
};

// Get the appropriate instruction text based on OS
const getZoomInstructions = () => {
  const os = getOperatingSystem();
  const keySymbol = getModifierKeySymbol();
  
  if (os === 'Android' || os === 'iOS') {
    return `Use ${keySymbol} to zoom the map`;
  }
  
  return `Use ${keySymbol} + scroll to zoom the map`;
};

// Get the appropriate icon based on marker state
const getMarkerIcon = (icon, isHotel, hotelSelected, airport, selectedAirport) => {
  // For hotel pin, use inverted icon only when selected (not on hover)
  if (isHotel && hotelSelected) {
    return createInvertedIcon();
  }
  
  // For clicked airport pins, use inverted icon (not on hover)
  if (airport && selectedAirport && selectedAirport.id === airport.id) {
    return createInvertedIcon();
  }
  
  // For all other pins, use the regular icon
  return icon;
};

// MarkerWithPopup component to handle marker interactions
const MarkerWithPopup = ({ position, icon, title, isActive, onMarkerClick, airport, selectedAirport, isHotel, hotelSelected, onMouseEnter, onMouseLeave }) => {
  const markerRef = useRef(null);
  const map = useMap();
  
  useEffect(() => {
    if (markerRef.current) {
      if (isActive) {
        markerRef.current.openPopup();
      } else {
        markerRef.current.closePopup();
      }
    }
  }, [isActive]);
  
  const handleMarkerClick = () => {
    // Focus the map on the marker's position when clicked
    map.setView(position, map.getZoom(), { animate: true, duration: 0.5 });
    
    if (onMarkerClick && airport) {
      onMarkerClick(airport);
    }
  };
  
  return (
    <Marker 
      position={position}
      icon={getMarkerIcon(icon, isHotel, hotelSelected, airport, selectedAirport)}
      ref={markerRef}
      eventHandlers={{
        click: handleMarkerClick,
        mouseover: () => {
          markerRef.current.openPopup();
          onMouseEnter?.();
        },
        mouseout: () => {
          if (!isActive) {
            markerRef.current.closePopup();
          }
          onMouseLeave?.();
        }
      }}
    >
      <Popup 
        className="map-popup"
        closeButton={false}
        autoPan={false}
      >
        <strong>{title}</strong>
      </Popup>
    </Marker>
  );
};

// MapEffect component to handle map events
const MapEffect = ({ setShowZoomMessage, setSelectedAirport, setHotelSelected }) => {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      // Disable scroll wheel zoom by default
      map.scrollWheelZoom.disable();
      
      // Track if command/ctrl key is pressed
      let commandKeyPressed = false;
      
      // Define event handler functions so they can be removed properly
      const handleKeyDown = (e) => {
        if (e.metaKey || e.ctrlKey) {
          commandKeyPressed = true;
          map.scrollWheelZoom.enable();
          // Hide the message if it's showing and user presses command/ctrl
          setShowZoomMessage(false);
        }
      };
      
      const handleKeyUp = (e) => {
        if (e.key === 'Meta' || e.key === 'Control') {
          commandKeyPressed = false;
          map.scrollWheelZoom.disable();
        }
      };
      
      const handleWheel = (e) => {
        if (!commandKeyPressed) {
          setShowZoomMessage(true);
          // Hide message after 3 seconds
          setTimeout(() => {
            setShowZoomMessage(false);
          }, 3000);
          
          // Don't prevent default scroll behavior on the page
          // Only prevent the map from zooming
          e.stopPropagation();
        } else {
          // If command key is pressed while message is showing, hide it
          setShowZoomMessage(false);
        }
      };
      
      const handleBlur = () => {
        commandKeyPressed = false;
        map.scrollWheelZoom.disable();
      };
      
      // Add handler for map clicks to deselect pins
      const handleMapClick = (e) => {
        // Check if the click was directly on the map (not on a marker)
        if (e.originalEvent.target.classList.contains('leaflet-container') || 
            e.originalEvent.target.classList.contains('leaflet-tile') ||
            e.originalEvent.target.classList.contains('leaflet-pane')) {
          // Deselect any selected airport and hotel
          setSelectedAirport(null);
          setHotelSelected(false);
        }
      };
      
      // Add event listeners
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      map.getContainer().addEventListener('wheel', handleWheel, { passive: true });
      window.addEventListener('blur', handleBlur);
      map.on('click', handleMapClick);
      
      return () => {
        // Clean up event listeners
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        if (map.getContainer()) {
          map.getContainer().removeEventListener('wheel', handleWheel);
        }
        window.removeEventListener('blur', handleBlur);
        map.off('click', handleMapClick);
      };
    }
  }, [map, setShowZoomMessage, setSelectedAirport, setHotelSelected]);
  
  return null;
};

const MapSection = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;

  @media (max-width: 768px) {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
  }
`;

const DirectionsPanel = styled.div`
  flex: 0 0 30%;
  display: flex;
  flex-direction: column;
  background: rgba(214, 108, 122, 0.95);
  padding: 1.5rem;
  overflow-y: auto;
  
  @media (max-width: 768px) {
    flex: none;
  }
`;

const PanelTitle = styled(motion.h2)`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(1.2rem, 2.5vw, 1.5rem);
  font-weight: normal;
  margin-bottom: 0.5rem;
  color: white;
  padding-bottom: 0.5rem;
  
  @media (max-width: 768px) {
    text-align: center;
  }
`;

const MapWrapper = styled.div`
  flex: 1;
  height: 100%;
  position: relative;
  
  .leaflet-container {
    background-color: #ffffff;
  }
  
  .leaflet-control-zoom {
    display: none !important;
  }
  
  .leaflet-popup-content-wrapper {
    border-radius: 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .leaflet-popup-content {
    font-family: 'BiancoSans', sans-serif;
    font-size: 0.9rem;
    color: #666;
    margin: 0.5rem 1rem;
  }
  
  .leaflet-popup-tip {
    background: white;
  }
  
  @media (max-width: 768px) {
    flex: none;
    height: 60vh;
    min-height: 400px;
  }
`;

const AirportLink = styled(motion.a)`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
  color: white;
  text-decoration: none;
  display: block;
  padding: 0.75rem 0;
  transition: all 0.2s ease;
  position: relative;

  &:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }

  &:hover {
    text-decoration: underline;
  }

  &.active {
    font-weight: bold;
  }

  &::after {
    content: " →";
    opacity: 0.7;
  }
`;

const SectionTitle = styled(motion.h3)`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(1rem, 2vw, 1.2rem);
  color: white;
  margin: 1.5rem 0 0.75rem;
  font-weight: normal;
  
  @media (max-width: 768px) {
    text-align: center;
  }
`;

const CarRentalLink = styled(AirportLink)`
  padding: 0.5rem 0;
`;

const GettingHere = () => {
  // Add refs and state for map initialization
  const mapContainerRef = useRef(null);
  const [showZoomMessage, setShowZoomMessage] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState(null);
  const [hoveredAirport, setHoveredAirport] = useState(null);
  const [hotelSelected, setHotelSelected] = useState(false);
  const [hotelHovered, setHotelHovered] = useState(false);
  const zoomInstructions = getZoomInstructions();
  
  // Add function to handle map initialization with smoother zoom
  const handleMapReady = (map) => {
    // Make zooming smoother
    if (map && map.target) {
      map.target.options.wheelDebounceTime = 100; // Debounce wheel events
      map.target.options.wheelPxPerZoomLevel = 120; // More pixels needed to zoom one level
    }
    
    // If we're on mobile, adjust the zoom level
    // ... existing code ...
  };
  
  // Simplify the map initialization to improve performance
  useEffect(() => {
    if (mapContainerRef.current) {
      // Simpler approach to ensure map is properly sized
      const resizeMap = () => {
        if (mapContainerRef.current) {
          const event = window.document.createEvent('UIEvents');
          event.initUIEvent('resize', true, false, window, 0);
          window.dispatchEvent(event);
        }
      };
      
      // Call resize when the component mounts
      setTimeout(resizeMap, 100);
      
      // Also handle window resize events
      window.addEventListener('resize', resizeMap);
      return () => {
        window.removeEventListener('resize', resizeMap);
      };
    }
  }, []);

  const airports = [
    {
      id: 'ath',
      name: "Athens International Airport (ATH)",
      position: [37.9364, 23.9445],
      googleMapsUrl: "https://www.google.com/maps/dir/Athens+International+Airport,+Attiki+Odos,+Spata-Artemida/Rovies+342+00,+Greece"
    },
    {
      id: 'jsi',
      name: "Skiathos Airport (JSI)", 
      position: [39.1771, 23.5037],
      googleMapsUrl: "https://www.google.com/maps/dir/Skiathos+Airport,+Skiathos/Rovies+342+00,+Greece"
    },
    {
      id: 'vol',
      name: "Nea Anchialos Airport (VOL)",
      position: [39.2194, 22.7944],
      googleMapsUrl: "https://www.google.com/maps/dir/Nea+Anchialos+National+Airport,+Almyros/Rovies+342+00,+Greece"
    }
  ];

  const carRentals = [
    {
      name: "Hertz Car Rental",
      url: "https://www.hertz.com/rentacar/reservation/"
    },
    {
      name: "Avis Car Rental",
      url: "https://www.avis.com/"
    },
    {
      name: "Enterprise Rent-A-Car",
      url: "https://www.enterprise.com/"
    }
  ];

  const center = [38.8090242, 23.2286358]; // To Rodi Boutique Hotel exact location

  // Handle airport selection
  const handleAirportClick = (airport) => {
    // If clicking the same airport, deselect it
    if (selectedAirport && selectedAirport.id === airport.id) {
      setSelectedAirport(null);
    } else {
      setSelectedAirport(airport);
    }
  };

  // Handle hotel click
  const handleHotelClick = () => {
    setSelectedAirport(null);
    setHotelSelected(!hotelSelected);
  };

  return (
    <MapSection>
      <DirectionsPanel>
        <PanelTitle
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          Getting Here
        </PanelTitle>
        {airports.map((airport, index) => (
          <AirportLink
            key={airport.name}
            href={airport.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.2 }}
            onMouseEnter={() => setHoveredAirport(airport)}
            onMouseLeave={() => setHoveredAirport(null)}
            className={selectedAirport && selectedAirport.id === airport.id ? 'active' : ''}
          >
            {airport.name}
          </AirportLink>
        ))}

        <SectionTitle
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          Car Rental Services
        </SectionTitle>
        {carRentals.map((rental, index) => (
          <CarRentalLink
            key={rental.name}
            href={rental.url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.2 }}
          >
            {rental.name}
          </CarRentalLink>
        ))}
      </DirectionsPanel>
      <MapWrapper ref={mapContainerRef} className="MapWrapper">
        <MapContainer
          center={center}
          zoom={8}
          scrollWheelZoom={false}
          touchZoom={true}
          doubleClickZoom={true}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          whenReady={handleMapReady}
          preferCanvas={true}
        >
          <TileLayer
            url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png"
            attribution='&copy; Carto, OpenStreetMap contributors'
          />
          <MapEffect 
            setShowZoomMessage={setShowZoomMessage} 
            setSelectedAirport={setSelectedAirport} 
            setHotelSelected={setHotelSelected} 
          />
          
          <MarkerWithPopup
            position={center}
            icon={hotelIcon}
            title="Rodi Boutique Hotel"
            isActive={hotelSelected || hotelHovered}
            onMarkerClick={handleHotelClick}
            selectedAirport={selectedAirport}
            isHotel={true}
            hotelSelected={hotelSelected}
            onMouseEnter={() => setHotelHovered(true)}
            onMouseLeave={() => setHotelHovered(false)}
          />
          
          {airports.map((airport) => (
            <MarkerWithPopup
              key={airport.id}
              position={airport.position}
              icon={airportIcon}
              title={airport.name}
              isActive={hoveredAirport?.id === airport.id || selectedAirport?.id === airport.id}
              onMarkerClick={handleAirportClick}
              airport={airport}
              selectedAirport={selectedAirport}
              isHotel={false}
              hotelSelected={hotelSelected}
            />
          ))}
        </MapContainer>
        
        {showZoomMessage && (
          <div className="zoom-overlay">
            <div className="zoom-message-container">
              <div className="zoom-message-text">
                {zoomInstructions}
              </div>
            </div>
          </div>
        )}
      </MapWrapper>
    </MapSection>
  );
};

export default GettingHere;