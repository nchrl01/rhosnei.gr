import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import './Area.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import AreaSubmenu from './AreaSubmenu';
import AreaHeader from './AreaHeader';

const commonAnimation = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.1 }
};

const FiltersSection = styled.div`
  width: 100%;
  position: sticky;
  top: 0;
  z-index: ${props => props.$isSubmenuOpen ? 1 : 3};
  background-color: #f5f1eb;
  padding: 0.75rem 1rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
`;

const FiltersToggle = styled(motion.button)`
  font-family: 'BiancoSans', sans-serif;
  padding: 3px 10px;
  background: transparent;
  border: 1px solid #d66c7a;
  color: #d66c7a;
  cursor: pointer;
  font-size: clamp(0.65rem, 1.5vw, 0.75rem);
  transition: all 0.2s ease;
  align-items: center;
  gap: 0.25rem;
  border-radius: 12px;
  display: none;

  &:hover {
    background: #d66c7a;
    color: white;
  }

  @media (max-width: 768px) {
    display: flex;
  }

  svg {
    transition: transform 0.2s ease;
    transform: ${props => props.$isOpen ? 'rotate(180deg)' : 'rotate(0deg)'};
  }
`;

const FiltersList = styled(motion.div)`
  background: transparent;
  padding-top: 0.2625rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  width: 100%;
  overflow: hidden;
  justify-content: center;

  @media (min-width: 769px) {
    height: auto !important;
    opacity: 1 !important;
    margin-top: 0.2625rem !important;
  }

  @media (max-width: 768px) {
    padding: 0;
  }
`;

const FiltersContent = styled(motion.div)`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  width: 100%;
  justify-content: center;
  padding: ${props => props.$isMobile ? '0.2625rem 0 0' : '0'};

  @media (min-width: 769px) {
    opacity: 1 !important;
    transform: none !important;
  }
`;

const FilterPill = styled.button`
  font-family: 'BiancoSans', sans-serif;
  padding: 3px 10px;
  background: ${props => props.selected ? '#d66c7a' : 'transparent'};
  border: 1px solid #d66c7a;
  color: ${props => props.selected ? 'white' : '#d66c7a'};
  cursor: pointer;
  font-size: clamp(0.65rem, 1.5vw, 0.75rem);
  transition: all 0.2s ease;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 0.25rem;

  &:hover {
    background: #d66c7a;
    color: white;
  }

  span {
    opacity: 0.8;
  }
`;

const ClearButton = styled.button`
  font-family: 'BiancoSans', sans-serif;
  background: transparent;
  border: none;
  color: #d66c7a;
  cursor: pointer;
  font-size: clamp(0.65rem, 1.5vw, 0.75rem);
  padding: 3px 10px;
  opacity: 0.9;
  border: 1px solid transparent;
  border-radius: 12px;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(214, 108, 122, 0.3);
  }
`;

const MainContent = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100vh;
`;

const ContentWrapper = styled.div`
  flex: 1;
  background: #f8f8f8;
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const ContentLayout = styled.div`
  display: flex;
  width: 100%;
  flex: 1;
  position: relative;
  height: 100%;
  
  @media (max-width: 768px) {
    flex-direction: column;
    height: 100%;
  }
`;

const AttractionListSection = styled.div`
  flex: 1;
  min-width: 0;
  position: relative;
  height: 100%;
  overflow: hidden;
  background: #f8f8f8;
  display: flex;
  flex-direction: column;
  
  @media (min-width: 769px) {
    width: 40%;
  }
`;

const AttractionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  height: 100%;
  overflow-y: ${props => props.$isSubmenuOpen ? 'hidden' : 'auto'};

  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(214, 108, 122, 0.3);
    border-radius: 2px;
    
    &:hover {
      background: rgba(214, 108, 122, 0.5);
    }
  }

  scrollbar-width: thin;
  scrollbar-color: rgba(214, 108, 122, 0.3) transparent;
`;

const AttractionCard = styled(motion.div)`
  border: 1px solid rgba(214, 108, 122, 0.2);
  padding: 1rem;
  background: rgba(255, 255, 255, 0.95);
  transition: all 0.2s ease;
  height: fit-content;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(214, 108, 122, 0.1);
  }
`;

const AttractionTitle = styled.h3`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.8rem, 2vw, 0.9rem);
  font-weight: normal;
  margin-bottom: 0.5rem;
  color: #d66c7a;
`;

const Description = styled.p`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  font-weight: normal;
  line-height: 1.5;
  margin-bottom: 0.5rem;
  color: #666;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Categories = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const CategoryTag = styled.span`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.65rem, 1.5vw, 0.75rem);
  font-weight: normal;
  padding: 3px 10px;
  background: rgba(214, 108, 122, 0.1);
  color: #d66c7a;
  border-radius: 12px;
`;

const MapSection = styled.div`
  display: none;
  position: relative;
  
  @media (min-width: 769px) {
    display: block;
    width: 60%;
    height: 100%;
    background: #ffffff;
    overflow: hidden;

    .leaflet-container {
      height: 100%;
      width: 100%;
      background-color: #ffffff;
    }
  }
`;

const getFirstTwoSentences = (text) => {
  const matches = text.match(/[^.!?\n]+[.!?\n]+/g);
  if (!matches) return text;
  
  let result = '';
  let count = 0;
  for (let i = 0; i < matches.length && count < 2; i++) {
    const sentence = matches[i];
    if (!/^[A-Z][a-z]{1,2}\.$/.test(sentence.trim())) {
      result += sentence;
      count++;
    }
  }
  return result.trim();
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

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
  shadowUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAYAAACoYAD2AAAACXBIWXMAAA7DAAAOwwHHb6hkAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAABaFJREFUWIXNmGlsFGUYx3/PzO7s2V7bbbdQWnqwBS3hkgYwgBgICRhC1BAI8YOGDwqJiSYGMeGbIcYPxkQSiCGEKJAYPkBCiCFylGsIV2M5tjQcAVugLdvutss2u9vZnccPs0Wlp+wu4T95M5P3eef/e+Z9n3dmVqWU4n4GBtx3kv8k/5PUg8Rg0Ilwm1Hy/4l0GDQiPCYUTUXTFEqBqoLFoNE+ZEfRVGxGDZtRx2XSsRoE4TYjQghiqQzxVJZoMkNX/zixVJZEOovZoGM36f8eSTc+E/XlVvwuEy6Tjt2ko6oKKSWJdJZoMkP3wASdAxNEkxmEgFDQRpHdSMBpxmPRsRl0mHSNZDpLLJXhRjhBOJoklszgterUl9uQUhFPZUhksgyOp+gZjhNNZLDqBYvKbDjNOlaTgCvhBKqmYDFopLI5JtI5Qn4b4WiSjv5xLt+KIhC4LQZqS20EnCasBoHDpGMxaGiqQjKT42o4wbVwHE1TKXOZqS2xUOI0IxREkxmuhxN0D04QiWewGXVWVTrwO814rAaklNyMJugYiNM/lmRZ0EHIY8Zm1DAZZL6QQhBJZLgZTdA5ME40kcVl0lhcbsdnN+K1GDAZBE6zTjgaRwBTaYXXYcRm0Ih0j3H+ZpRkOofXamBluQOnxYDTrGM3aqiawGXWGYmlGIqnGRxPMTCWYjieRlUVgl4zPrsRv8uEz27EYzUQTWZo7Y3RMxTHbTWweoaDgNOMy6yjqQoTqSzhWIqbIwl6RxKEY0mMQmVeyEHAacZtMaAogqGJFNcjCboGJxhPZbEZNZaU2fHZjXitBkwGgcusE46NI6VCKIUQAiklVqMOQN9oguO/DtE+EKfCY2ZeyE5dmR2XxYDdqGE1CKSUJNJZxpJZrg3H6RtNMDSRxqAJqrxWgh4zAacZj82A06STzEiuhxN0DU4QiWewGwWLy+z47EY8VgMGTWUileVmJEHXYJyReBqLQbAk6KDYYcJnN2LSNVRFYTSZoXskQe9wnEgig82oUV9mJ+ixYDcKnGYdoQqiyQw3Iwm6ByeIJrK4zDqLgnZ8diM+mxGTQeA06wyOJ7kRSXAjkiCZyVHmMlNXasPvNOO2GDAZBE6Lzkg8zVA8zcB4ioHxFLFkFrNBUOWzEnSb8TtMeKwGpJTciiXpHIjTN5rEYzWwstxO0G3BYzVgEAoGXSORytI7HKd7aIJYMoPTrLO0zI7XbsRnM2LSNVwWneFYiqF4msHxFIPjKUbjaTQFgm4LfqcJv8OE127EbtSIp7J0D8XpHU4QiWewGQXzgnaCbgsBpxm3xYBBU0mks/QMx+kajDOayGA36SwP2fHZjXhtRox6fk5ORJMMjqfoH0vSP5YkkcpiMWjUFtsIuM0UO0zYjRqJdJbekQTdQxOMxNPYjRrLQw58diM+uxGTrqEogtFkht6RBD1DcYYn0ph0lQUldvxOEz67CZtRkM7muBVL0jkQZyCWxGXWWRZ04HeY8NmNGHUNRRFEExm6h+J0D8UZT2ZxmnUWldnw2Y34bEbMukYmJxmKp+gfi9M3mmQskUZTFaq8VoIeM36HCZfZgKYojCezdA/F6R6KE01kcZp0FlbY8NmM+B1GLAZBJicZiqXoGU7QN5ognspiN+ksLLURcJrx2Y2YdA1FEYzE03QPxekZTpBIZ/FYDSwI2Ai4zPgdJiwGQSaXIxxL0TsSp380QTKTw2MxUF9mI+Ay43eYsBp0cjlJfyxJ73CC/rEkyUwOp1lnYYWdoNuMz27CrGvkpGQolqJvNEHfaJJEOofTrFNfZiPgMuN3mLAaBDkp6R9L0jeSoG80QSqbw2XWqS+3EXCa8TtMWA2CrJQMjCXpHUnQN5ogmc7hshioL7URdJvxO0xYDIKslAzGkvSNJukbTZDK5HCadRaU2Ai6zPgdJmxGQVZKwrEUvSMJ+kYTJNI5nGad+jIbQY8Zv92ExSjISslgLEnvSIK+0QSpbA6HWWdBsZWA24zfYcRmFGRzksFYit6ROP2jSZKZHA6TzsJiG0G3Bb/DhNWgkc1JhmIpekfi9I8lSGVyOEw6C0psBNxm/A4jNqNGVkoGx1P0jcTpH02QyuRwmHUWFtsIuC347SasBkFWSgbHU/SNxOkfS5LK5LAbdeaX2Ai4zPgdJmxGQU5KBsdT9I7E6R9LksrksBt15hfbCLjM+B1GbEZBTkqGxlP0jsTpG02QzOSwm3Tqy2wE3Rb8dhNWoyAnJUOxJH2jCXpHEvSNJkikszjMOvNLbATdFvx2E1ajRk5KhmNJekfi9I0mSKSzOMw680tsBN0W/HYTNqMgJyVDsSS9own6RhMk0lkcJp36MhtBtwW/3YTVqJGTkuFYit6RBH2jCRLpLA6Tzxia36O7SasRkFOSoZjKXpHEvSNJkiks9hNOvNLbATdFvx2E1ajRk5KRmJJro3E6R1NkEhnsZt05pVYCbgt+O1GbEaNnJSMxJL0jSToG02QSGexm3TmldoIuC347UasRo2clIzEkvSNJOgdTZBIZ7GbdOaVWgm4LPjtJmxGQU5KRmJJ+kYT9I4kSKSz2E0680qtBFwW/HYTNqMgJyUjsSR9own+AJRLG8lQx7CBAAAAAElFTkSuQmCC',
  shadowSize: [41, 41],
  shadowAnchor: [13, 41]
});

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

const Area = () => {
  const location = useLocation();
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);
  const isMobile = useIsMobile();
  const [selectedAttraction, setSelectedAttraction] = useState(null);
  const [hoveredAttraction, setHoveredAttraction] = useState(null);
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [showZoomMessage, setShowZoomMessage] = useState(false);
  const zoomInstructions = getZoomInstructions();

  // Add this function to handle map initialization
  const handleMapReady = () => {
    setMapReady(true);
  };
  
  // Function to find an attraction by coordinates - moved inside the component
  const findAttractionByCoordinates = (coordinates) => {
    return attractions.find(attraction => 
      attraction.coordinates && 
      attraction.coordinates[0] === coordinates[0] && 
      attraction.coordinates[1] === coordinates[1]
    );
  };
  
  // MapEffect component to handle map events
  const MapEffect = ({ setShowZoomMessage }) => {
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
        
        // Add event listeners
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        map.getContainer().addEventListener('wheel', handleWheel, { passive: true });
        window.addEventListener('blur', handleBlur);
        
        return () => {
          // Clean up event listeners
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
          if (map.getContainer()) {
            map.getContainer().removeEventListener('wheel', handleWheel);
          }
          window.removeEventListener('blur', handleBlur);
        };
      }
    }, [map, setShowZoomMessage]);
    
    return null;
  };

  // MarkerWithPopup component to handle marker interactions
  const MarkerWithPopup = ({ position, icon, title, isActive, onMarkerClick, attraction }) => {
    const markerRef = useRef(null);
    const map = useMap();
    
    // Create a highlighted icon for selected markers
    const getMarkerIcon = () => {
      // Hotel pin should stay how it is always
      if (title === "Rodi Boutique Hotel") {
        return hotelIcon;
      }
      
      // For clicked attraction pins, use inverted icon (white with pinkish outline)
      if (attraction && selectedAttraction?.id === attraction.id) {
        return createInvertedIcon();
      }
      
      // For hovered pins, use the regular icon
      return icon;
    };
    
    useEffect(() => {
      if (isActive && markerRef.current) {
        markerRef.current.openPopup();
      } else if (!isActive && markerRef.current) {
        markerRef.current.closePopup();
      }
    }, [isActive]);
    
    const handleClick = () => {
      // Focus the map on the marker's position when clicked
      map.setView(position, map.getZoom(), { animate: true, duration: 0.5 });
      
      if (attraction) {
        onMarkerClick(attraction);
      } else if (title === "Rodi Boutique Hotel") {
        // Handle hotel marker click if needed
      } else {
        // Try to find attraction by coordinates
        const foundAttraction = findAttractionByCoordinates(position);
        if (foundAttraction) {
          onMarkerClick(foundAttraction);
        }
      }
    };
    
    return (
      <Marker 
        position={position}
        icon={getMarkerIcon()}
        ref={markerRef}
        eventHandlers={{
          click: handleClick,
          mouseover: () => markerRef.current.openPopup(),
          mouseout: () => !isActive && markerRef.current.closePopup()
        }}
      >
        <Popup 
          closeButton={false} 
          autoPan={false} 
          className="map-popup"
        >
          <strong>{title}</strong>
        </Popup>
      </Marker>
    );
  };

  useEffect(() => {
    if (location.state?.scrollTo) {
      const element = document.getElementById(location.state.scrollTo);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
    
    if (location.state?.filter) {
      // Set initial filter based on type
      const filterMap = {
        'activities': ['Water Sports', 'Hiking'],
        'attractions': ['History', 'Nature', 'Religious', 'Beaches']
      };
      setSelectedFilters(filterMap[location.state.filter] || []);
      setIsFiltersVisible(true); // Show filters if coming from navigation
    }
  }, [location]);

  const attractions = [
    {
      id: 'rovies-town',
      title: "Rovies",
      description: "Nestled between the pine-covered mountains of Telethrio and Kavallaris, Rovies is a picturesque village surrounded by extensive olive groves that stretch from the mountain foothills to the sea. Historically identified with the ancient town of Orobiae, as mentioned by Thucydides, Rovies was known for the Oracle of Apollo Selinuntius, believed to have been located near the present-day area of Taxiarchis, close to the Monastery of Saint Irene Chrysovalantou. The name \"Rovies\" is thought to derive from \"orobos,\" a plant that thrived in the area and was used as fodder for cattle. The region has been continuously inhabited since the Neolithic era. In 426 B.C., a devastating earthquake and subsequent tsunami destroyed the ancient city, leading survivors to relocate to nearby areas. During the Byzantine and Venetian periods, Rovies gained significance, as evidenced by the medieval tower built in 1256 by William of Villehardouin, which still stands in the village center. Following the Ottoman conquest of Euboea in 1470, Rovies maintained its administrative importance as the capital of the local district (Nahiyie of Rovies). In 1832, the area was sold by its Turkish owner to Apostolos Doumas. By 1836, Rovies became part of the newly established municipality of Aegeon, with Limni as its capital, until 1912. After the municipality's dissolution, Rovies became an independent community, encompassing settlements like Kalamoudi, Marouli, Koulouros, Paliochori, Damia, Drymonas, Agiannakos, and Mandanika (Daphne). In 1997, it was incorporated into the Kapodistrian municipality of Elymnies. As of the 2001 census, Rovies had a population of approximately 1,500 residents.\n\n" +
        "**LOCAL FESTIVALS AND TRADITIONS**\n" +
        "• Clean Monday (Ash Monday): Celebrated at Herakli Beach with traditional Lenten foods, seafood, olives, and 'lagana' bread. The day features kite-flying symbolizing spiritual upliftment. In 2025, Clean Monday falls on March 3rd.\n" +
        "• May 1st – The Custom of Pepper: A unique local tradition welcoming spring with community festivities.\n" +
        "• June 29th – Feast of Apostles Peter and Paul: A religious festival featuring church services, traditional music, and dance, celebrating community and cultural heritage.",
      coordinates: [38.8106019, 23.2307804],
      categories: ["Town", "History"]
    },
    {
      id: 'limni-town',
      title: "Limni",
      description: "A charming coastal town built amphitheatrically around a sheltered bay, Limni features island-like architecture with narrow cobblestone streets and traditional houses adorned with bougainvillea. Located near ancient Elymnion, the town was significantly developed by Aegean island settlers in the mid-16th century and played a key role in the Greek War of Independence. Today, its vibrant waterfront offers cafes and tavernas with views of the northern Euboean Gulf.\n\n" +
        "**ELYMNIA FESTIVAL**\n" +
        "Held annually from mid-July to August 15th, the Elymnia Festival is one of northern Evia's most significant cultural events. The festival features:\n" +
        "• Book presentations and literary events\n" +
        "• Theatrical performances\n" +
        "• Musical concerts\n" +
        "• Art exhibitions\n" +
        "• Athletic competitions (land and sea)\n" +
        "The festival showcases the region's rich artistic and cultural traditions, bringing together locals and visitors for a celebration of arts and culture.",
      coordinates: [38.76667, 23.31667],
      googleMapsLink: "https://maps.google.com/?q=38.76667,23.31667",
      categories: ["Town", "History"]
    },
    {
      id: 'aidipsos-town',
      title: "Aidipsos",
      description: "Located 20 km north of Rovies, Aidipsos is famous for its therapeutic thermal springs used since ancient times. The Roman general Sulla constructed baths here, remnants of which are still visible today. The town continues its legacy as a premier wellness destination, offering natural hot springs for relaxation and healing.",
      coordinates: [38.86667, 23.05000],
      googleMapsLink: "https://maps.google.com/?q=38.86667,23.05000",
      categories: ["Town", "History", "Wellness"]
    },
    {
      id: 'drymonas-waterfalls',
      title: "Waterfalls of Drymonas – Mount Xiron Trail",
      description: "A breathtaking natural paradise featuring the stunning Drymonas Waterfall and an exhilarating hiking trail to Mount Xiron's summit. Situated at an altitude of 620 meters, between the villages of Kerasia and Drymonas, this trail offers a moderate challenge with rewarding panoramic views.\n\n" +
        "**WATERFALL**\n" +
        "Drymonas Waterfall: A 15-meter waterfall, formed by the Sipias River, cascading into a tranquil pool surrounded by dense forest.\n\n" +
        "**TRAIL DETAILS**\n" +
        "• Difficulty: Moderate to challenging\n" +
        "• Duration: 2 to 2.5 hours to the summit (one way)\n" +
        "• Starting Point: Drymonas Waterfall parking area (620m)\n" +
        "• Summit: Mount Xiron (990m)\n" +
        "• Features: Lush pine forests, rare black pines, diverse flora and fauna\n" +
        "• Views: Panoramic vistas of Central Evia, the Sporades Islands, and on clear days, Mount Athos\n\n" +
        "**FACILITIES**\n" +
        "• Well-maintained wooden paths and bridges\n" +
        "• Forestry service exhibition displaying local fossils and plant species\n" +
        "• Resting areas along the trail\n\n" +
        "**DIRECTIONS**\n" +
        "From Rovies, take the Rovies-Edipsos road and turn towards the Monastery of Saint David. Pass through the villages of Paliohori, Damia, Kalamoudi, and Drymonas. The trail starts at the Drymonas Waterfall parking area.\n\n" +
        "**RECOMMENDATIONS**\n" +
        "• Wear sturdy hiking boots and bring trekking poles\n" +
        "• Carry at least 1.5L of water per person\n" +
        "• Pack warm layers, as temperatures drop at higher altitudes\n" +
        "• Start early in the morning to avoid midday heat\n" +
        "• Allow 5-6 hours total for the full trail experience (including breaks)\n" +
        "• Download an offline map, as cell service is limited\n" +
        "• Bring a jacket, as temperatures are cooler at higher elevations",
      coordinates: [38.8459, 23.2820],
      googleMapsLink: "https://maps.google.com/?q=38.8459,23.2820",
      categories: ["Nature", "Hiking"]
    },
    {
      id: 'kerasia-fossil-museum',
      title: "Kerasia Museum of Fossils",
      description: "Home to an impressive collection of 6.5-9 million-year-old fossils, featuring remains of 24 different prehistoric animal species discovered in the Kerasia area. Exhibits include fossils of machairodontes (saber-toothed cats), elladotherium, and rhinoceros skulls. Open 10:00-14:00 and 17:00-20:00, closed Mondays and Thursdays.",
      coordinates: [38.8459, 23.2820],
      googleMapsLink: null,
      categories: ["History"]
    },
    {
      id: 'limni-folklore-museum',
      title: "Historical and Folklore Museum of Limni",
      description: "Housed in a traditional two-story building in Limni's historic center, this museum showcases the area's rich cultural heritage. The ground floor features an archaeological collection including pottery, coins, and architectural fragments, offering insights into local history.",
      coordinates: [38.76667, 23.31667],
      googleMapsLink: null,
      categories: ["History"]
    },
    {
      id: 'venetian-tower',
      title: "Venetian Tower",
      description: "An impressive historical landmark standing as a testament to the region's medieval past. Located just 0.2 kilometers from the center, this well-preserved tower offers panoramic views of the surrounding landscape and serves as a reminder of the area's strategic importance.",
      coordinates: [38.811416, 23.230742],
      googleMapsLink: "https://maps.google.com/?q=38.811416,23.230742",
      categories: ["History"]
    },
    {
      id: 'rovies-beach',
      title: "Rovies Beach",
      description: "A pristine beach with crystal-clear waters and scenic backdrop of mountains. Perfect conditions for swimming and water activities, featuring a mix of sand and pebbles with calm waters ideal for families. The beach offers excellent conditions for various water sports including swimming, snorkeling, and paddling in its tranquil waters.",
      coordinates: [38.8013681, 23.2330095],
      googleMapsLink: "https://maps.google.com/?q=38.8013681,23.2330095",
      categories: ["Beaches", "Water Sports"]
    },
    {
      id: 'lihadonisia',
      title: "Lihadonisia",
      description: "Take a summer boat trip from Rovies or Aidypsos to Lihadonisia, known as the 'Seychelles of Evia'. These small islands feature crystal clear waters, golden sand, and beach bars at Monolia beach. Lucky visitors might spot the resident monachus monachus seals.",
      coordinates: [38.8197939, 22.8192125],
      googleMapsLink: "https://maps.google.com/?q=38.8197939,22.8192125",
      categories: ["Nature", "Beaches"]
    },
    {
      id: 'vrynioti-winery',
      title: "Vrynioti Winery",
      description: "Located at Gialtra, approximately 30 km from the hostel at the foot of Telethrion mountain, this family winery offers year-round visits. Tour the modern facility to learn about wine production and enjoy tastings in their dedicated tasting room.",
      coordinates: [38.866896, 22.9736972],
      phoneNumber: "+30 32 429 22260",
      website: "www.vriniotiwines.gr",
      categories: ["Dining"]
    },
    {
      id: 'taverna-paralia',
      title: "Paralia Pine & Sea",
      description: "Located on Rovies Beach, this taverna offers fresh seafood and traditional Greek cuisine with beautiful sea views.",
      coordinates: [38.8016702, 23.2328787],
      googleMapsLink: "https://maps.google.com/?q=38.8016702,23.2328787",
      categories: ["Dining"]
    },
    {
      id: 'taverna-senioros',
      title: "Senioros Psarotaverna",
      description: "A traditional fish taverna in Rovies, known for its fresh catch of the day and authentic Greek dishes.",
      coordinates: [38.8099415, 23.2274392],
      googleMapsLink: "https://maps.google.com/?q=38.8099415,23.2274392",
      categories: ["Dining"]
    },
    {
      id: 'taverna-klimataria',
      title: "Taverna Klimataria",
      description: "A charming local taverna in Rovies offering homestyle Greek cooking in a traditional atmosphere.",
      coordinates: [38.8570552, 23.0482738],
      googleMapsLink: "https://maps.google.com/?q=38.8570552,23.0482738",
      categories: ["Dining"]
    },
    {
      id: 'taverna-bella-vista',
      title: "Bella Vista",
      description: "Located in Limni, this taverna offers panoramic views along with delicious local cuisine and seafood specialties.",
      coordinates: [38.7737528, 23.2849164],
      googleMapsLink: "https://maps.google.com/?q=38.7737528,23.2849164",
      categories: ["Dining"]
    },
    {
      id: 'monastery-galataki',
      title: "Monastery of St. Nicholas Galataki",
      description: "This Byzantine-era convent is situated in the foothills of Mount Kandili, approximately 9 km east of Limni, Evia. A coastal asphalt road through lush landscapes leads directly to the monastery, which features a prominent defensive tower reminiscent of those found in Mount Athos monasteries. The monastery was established in the 10th century by a shipwrecked sailor from the Galata region of Constantinople, which is the origin of its name. It is dedicated to St. Nicholas, the patron saint of sailors. The monastery celebrates its feast days on May 20 and December 6.",
      coordinates: [38.7166837, 23.3713589],
      googleMapsLink: "https://maps.google.com/?q=38.7166837,23.3713589",
      categories: ["Religious", "History"]
    },
    {
      id: 'monastery-david',
      title: "Monastery of Saint David the Elder",
      description: "Founded in the 16th century by Saint David on Mount Kavallaris, this post-Byzantine male monastery is located approximately 12 km south of Rovies, near the village of Drimona. Saint David established the monastery around 1535-1540 on the ruins of an ancient church dedicated to the Transfiguration of Christ. The monastery was destroyed by the Turks in 1823 due to its support for the Greek Revolution but was reconstructed in 1877. It houses the relics of Saint David, including his censer and priestly stole. The monastery celebrates the feast of the Transfiguration on August 6 and Saint David's feast day on November 1.",
      coordinates: [38.8459, 23.2820],
      googleMapsLink: "https://maps.google.com/?q=38.8459,23.2820",
      categories: ["Religious", "History"]
    },
    {
      id: 'monastery-irene',
      title: "Monastery of Saint Irene Chrysovalantou",
      description: "This modern female monastery is situated in a picturesque location near the Limni-Rovies-Aidipsos road, approximately 5 minutes from a local guesthouse. Specific historical details about this monastery are limited.",
      coordinates: [38.8106019, 23.2307804],
      googleMapsLink: null,
      categories: ["Religious"]
    },
    {
      id: 'monastery-george',
      title: "Monastery of St. George Ilia",
      description: "Located about 13 km from Aidipsos, above the village of Ilia in northern Evia, this post-Byzantine convent is known for its serene environment. Further historical information is not readily available.",
      coordinates: [38.86667, 23.05000],
      googleMapsLink: null,
      categories: ["Religious"]
    },
    {
      id: 'pilgrimage-john-russian',
      title: "Pilgrimage of Saint John the Russian",
      description: "Situated in the community of Prokopi, within the fertile green valley of the Kireas River, this church is dedicated to Saint John the Russian, who passed away in 1730. His relics are enshrined in a marble tomb, making it a significant pilgrimage site for Orthodox Christians in Greece. The church celebrates a major festival on May 27, attracting numerous believers, some of whom arrive on foot from nearby villages to pay homage.",
      coordinates: [38.6500, 23.4667],
      googleMapsLink: "https://maps.google.com/?q=38.6500,23.4667",
      categories: ["Religious", "History"]
    },
    {
      id: 'cloister-christodoulos',
      title: "Cloister of Saint Christodoulos",
      description: "This cavernous chapel is located at the western end of the waterfront in Limni. According to tradition, it served as the dwelling of Saint Christodoulos, the founder of the renowned Monastery of St. John the Theologian on Patmos Island. The cloister offers a glimpse into the ascetic life of the saint.",
      coordinates: [38.761137, 23.324612],
      googleMapsLink: "https://maps.google.com/?q=38.761137,23.324612",
      categories: ["Religious", "History"]
    },
    {
      id: 'heracli-beach',
      title: "Heracli (Hercules) Beach",
      description: "A beautiful beach with fine gravel, crystal-clear blue waters, and pine trees that extend to the shoreline. The natural setting creates a perfect blend of forest and sea.",
      coordinates: [38.8106019, 23.2307804],
      googleMapsLink: null,
      categories: ["Beaches", "Nature"]
    },
    {
      id: 'ai-apostoli-beach',
      title: "Ai Apostoli Beach",
      description: "A quiet, small beach along the Olive Grove coastline, ideal for peaceful swims. Perfect for those seeking tranquility away from crowded shores.",
      coordinates: [38.4137153, 24.1947592],
      googleMapsLink: "https://maps.google.com/?q=38.4137153,24.1947592",
      categories: ["Beaches", "Nature"]
    },
    {
      id: 'kamares-beach',
      title: "Kamares Beach",
      description: "A serene spot with clear waters, located near Rovies. The beach offers a peaceful environment for swimming and relaxation.",
      coordinates: [37.9683219, 24.3851942],
      googleMapsLink: "https://maps.google.com/?q=37.9683219,24.3851942",
      categories: ["Beaches", "Nature"]
    },
    {
      id: 'potami-beach',
      title: "Potami Beach",
      description: "A serene beach nestled in a natural cove, Potami Beach offers a tranquil escape with its crystal-clear waters and scenic surroundings. The beach is known for its natural beauty and peaceful atmosphere, making it perfect for those seeking a quiet day by the sea.",
      coordinates: [38.7532941, 23.6776933],
      googleMapsLink: "https://www.google.gr/maps/place/%CE%A0%CE%B1%CF%81%CE%B1%CE%BB%CE%AF%CE%B1+%CE%A0%CE%BF%CF%84%CE%AC%CE%BC%CE%B9+%CF%83%CF%84%CF%81%CE%BF%CF%86%CE%B7/@38.7532941,23.6776933,17z",
      categories: ["Beaches", "Nature"]
    },
    {
      id: 'etem-beach',
      title: "Etem Beach",
      description: "A lesser-known secluded beach with unspoiled beauty. Its hidden location helps maintain its pristine condition.",
      coordinates: [38.3983743, 23.810736],
      googleMapsLink: "https://maps.google.com/?q=38.3983743,23.810736",
      categories: ["Beaches", "Nature"]
    },
    {
      id: 'ampouria-beach',
      title: "Ampouria Beach",
      description: "A small, picturesque beach ideal for relaxation. Its intimate setting provides a perfect escape for beach lovers.",
      coordinates: [38.8772064, 22.948296],
      googleMapsLink: "https://maps.google.com/?q=38.8772064,22.948296",
      categories: ["Beaches", "Nature"]
    },
    {
      id: 'kohili-beach',
      title: "Kohili Beach Water Sports",
      description: "One of the most well-equipped beaches between Rovies and Limni. Features include beach bar, umbrellas, and water sports facilities.\n\nFACILITIES:\n• Organized beach with umbrellas and sunbeds\n• Beach bar serving drinks and light meals\n• Clean changing rooms and showers\n• Water sports equipment rental\n• Parking area\n\nWATER SPORTS:\n• Jet ski rental\n• Paddleboarding\n• Kayaking\n• Beach volleyball court\n\nDIRECTIONS: Located 0.8 km from Rovies center. Follow the coastal road towards Limni, beach is clearly marked. Parking available on-site.",
      coordinates: [38.7701522, 23.2961616],
      googleMapsLink: "https://www.google.gr/maps/place/Koxyli+beach/@38.7700882,23.2951295,426m/data=!3m2!1e3!4b1!4m6!3m5!1s0x14a0d6d0517a5251:0x943315dd188d1cc9!8m2!3d38.7701522!4d23.2961616!16s%2Fg%2F1s04w7x1n?entry=ttu",
      categories: ["Beaches", "Activities", "Water Sports"]
    },
    {
      id: 'spiada-beach',
      title: "Spiada Beach",
      description: "Another scenic beach in the same area, known for its pristine waters and natural setting. A perfect spot for enjoying the Mediterranean landscape.",
      coordinates: [38.768454, 23.282286],
      googleMapsLink: "https://maps.google.com/?q=38.768454,23.282286",
      categories: ["Beaches", "Nature"]
    },
    {
      id: 'horse-riding-centre',
      title: "Horse Riding Centre Kamatriades",
      description: "Located in Kamatriades Village, 15 km north of Rovies. The center offers riding lessons for all levels and guided trail rides through scenic mountain paths. Features include a training arena, café with panoramic views, and a petting zoo with mini-goats, deer, and various animals.\n\nDIRECTIONS: From Rovies, follow signs to Kamatriades Village. The center is well-marked at the village entrance.\n\nHOURS: Open daily 9 AM until sunset\nBOOKING: Contact Tassos Katsikogiannis",
      coordinates: [38.9500, 23.1500],
      phoneNumber: "+30 22260 87201, +30 697 020 7751",
      googleMapsLink: "https://maps.google.com/?q=38.9500,23.1500",
      categories: ["Nature"]
    },
    {
      id: 'sea-sports',
      title: "Nautical Club of Limni",
      description: "The Nautical Club of Limni offers a range of water sports activities. Established in 1953, the club promotes nautical sports and encourages both youth and adults to engage with the sea. Their programs include:\n\n" +
        "• Sailing: Training in both open sea and triangular course sailing\n" +
        "• Canoe-Kayak: Courses for various skill levels\n" +
        "• Swimming: Instruction and training sessions\n" +
        "• Windsurfing: Opportunities for learning and practice\n\n" +
        "The club also hosts cultural events, such as the annual \"Nautical Night at Elymnion\" every August 15th, featuring a sea spectacle with numerous boats and fireworks.",
      coordinates: [38.7615335, 23.3241892],
      phoneNumber: "+30 22270 31900",
      website: "www.nolimnis.gr",
      googleMapsLink: "https://www.google.gr/maps/place/%CE%9D%CE%B1%CF%85%CF%84%CE%B9%CE%BA%CF%8C%CF%82+%CE%8C%CE%BC%CE%B9%CE%BB%CE%BF%CF%82+%CE%9B%CE%AF%CE%BC%CE%BD%CE%B7%CF%82/@38.7617365,23.3237901,110m/data=!3m1!1e3!4m10!1m2!2m1!1sNautical+Club+of+Limni!3m6!1s0x14a0d6fb5e49249b:0x55624cfb54457658!8m2!3d38.7615335!4d23.3241892!15sChZOYXV0aWNhbCBDbHViIG9mIExpbW5pkgEKeWFjaHRfY2x1YuABAA!16s%2Fg%2F11fy_2h96h",
      categories: ["Water Sports", "Activities"]
    }
  ];

  const filters = [
    { label: "Religious", count: attractions.filter(a => a.categories.includes("Religious")).length },
    { label: "History", count: attractions.filter(a => a.categories.includes("History")).length },
    { label: "Nature", count: attractions.filter(a => a.categories.includes("Nature")).length },
    { label: "Beaches", count: attractions.filter(a => a.categories.includes("Beaches")).length },
    { label: "Hiking", count: attractions.filter(a => a.categories.includes("Hiking")).length },
    { label: "Water Sports", count: attractions.filter(a => a.categories.includes("Water Sports")).length },
    { label: "Dining", count: attractions.filter(a => a.categories.includes("Dining")).length },
    { label: "Town", count: attractions.filter(a => a.categories.includes("Town")).length },
    { label: "Wellness", count: attractions.filter(a => a.categories.includes("Wellness")).length }
  ];

  const toggleFilter = (filter) => {
    if (selectedFilters.includes(filter)) {
      setSelectedFilters(selectedFilters.filter(f => f !== filter));
    } else {
      setSelectedFilters([...selectedFilters, filter]);
    }
  };

  const clearFilters = () => {
    setSelectedFilters([]);
  };

  const filteredAttractions = selectedFilters.length === 0 
    ? attractions 
    : attractions.filter(attraction => 
        attraction.categories.some(category => selectedFilters.includes(category))
      );

  const filterCount = selectedFilters.length;

  const filterVariants = {
    open: {
      height: "auto",
      opacity: 1,
      marginTop: "0.5rem",
      transition: {
        height: { duration: 0.3, ease: "easeOut" },
        opacity: { duration: 0.2, delay: 0.1 }
      }
    },
    closed: {
      height: 0,
      opacity: 0,
      marginTop: 0,
      transition: {
        height: { duration: 0.3, ease: "easeIn" },
        opacity: { duration: 0.2 },
        marginTop: { duration: 0.3 }
      }
    },
    visible: {
      height: "auto",
      opacity: 1,
      marginTop: "0.5rem"
    }
  };

  const filterItemVariants = {
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2 }
    },
    hidden: {
      opacity: 0,
      y: 20,
      transition: { duration: 0.2 }
    }
  };

  const handleAttractionClick = (attraction) => {
    setSelectedAttraction(attraction);
    setIsSubmenuOpen(true);
    
    // If we have coordinates and the map is ready, pan to the attraction
    if (attraction.coordinates && mapRef.current && !isMobile) {
      mapRef.current.setView(attraction.coordinates, 12, {
        animate: true,
        duration: 1
      });
    }
  };

  // Create custom icons
  const hotelIcon = createCustomIcon('#d66c7a');
  const attractionIcon = createCustomIcon('#666666');

  return (
    <>
      <AreaHeader 
        filters={filters}
        selectedFilters={selectedFilters}
        toggleFilter={toggleFilter}
        clearFilters={clearFilters}
        isFiltersVisible={isFiltersVisible}
        setIsFiltersVisible={setIsFiltersVisible}
        isMobile={isMobile}
      />
      <MainContent>
        <ContentWrapper>
          <ContentLayout>
            <AttractionListSection className="attraction-list-section">
              <FiltersSection $isSubmenuOpen={isSubmenuOpen}>
                <FiltersToggle
                  onClick={() => setIsFiltersVisible(!isFiltersVisible)}
                  $isOpen={isFiltersVisible}
                  {...commonAnimation}
                >
                  {isFiltersVisible ? (
                    <>
                      Hide Filters
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  ) : (
                    <>
                      Filters {filterCount > 0 && `(${filterCount})`}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  )}
                </FiltersToggle>
                
                <FiltersList
                  initial="closed"
                  animate={isMobile ? (isFiltersVisible ? "open" : "closed") : "visible"}
                  variants={filterVariants}
                >
                  <FiltersContent 
                    $isMobile={isMobile}
                    initial="hidden"
                    animate="visible"
                    variants={filterItemVariants}
                  >
                    {filters.map((filter, index) => (
                      <FilterPill
                        key={filter.label}
                        selected={selectedFilters.includes(filter.label)}
                        onClick={() => toggleFilter(filter.label)}
                        variants={filterItemVariants}
                        custom={index}
                      >
                        {filter.label} ({filter.count})
                      </FilterPill>
                    ))}
                    {selectedFilters.length > 0 && (
                      <ClearButton onClick={clearFilters}>
                        Clear All
                      </ClearButton>
                    )}
                  </FiltersContent>
                </FiltersList>
              </FiltersSection>

              <AttractionsList $isSubmenuOpen={isSubmenuOpen}>
                {filteredAttractions.map((attraction, index) => (
                  <AttractionCard
                    key={attraction.id}
                    id={attraction.id}
                    {...commonAnimation}
                    transition={{ duration: 0.1 }}
                    onClick={() => handleAttractionClick(attraction)}
                    onMouseEnter={() => setHoveredAttraction(attraction)}
                    onMouseLeave={() => setHoveredAttraction(null)}
                  >
                    <AttractionTitle>{attraction.title}</AttractionTitle>
                    <Description>
                      {getFirstTwoSentences(attraction.description)}
                    </Description>
                    <Categories>
                      {attraction.categories.map(category => (
                        <CategoryTag key={category}>
                          {category}
                        </CategoryTag>
                      ))}
                    </Categories>
                  </AttractionCard>
                ))}
              </AttractionsList>
              
              <AreaSubmenu
                attraction={selectedAttraction}
                isOpen={isSubmenuOpen}
                onClose={() => setIsSubmenuOpen(false)}
              />
            </AttractionListSection>
            
            <MapSection ref={mapContainerRef} className="MapSection">
              <MapContainer
                center={[38.5, 23.8]}
                zoom={9}
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
                <MapEffect setShowZoomMessage={setShowZoomMessage} />
                
                {mapReady && (
                  <>
                    {/* Hotel marker */}
                    <MarkerWithPopup 
                      position={[38.8090242, 23.2286358]}
                      icon={hotelIcon}
                      title="Rodi Boutique Hotel"
                      isActive={false}
                    />

                    {/* Attraction markers */}
                    {filteredAttractions.map((attraction) => {
                      if (attraction.coordinates) {
                        // For attractions with single location
                        return (
                          <MarkerWithPopup
                            key={attraction.id}
                            position={attraction.coordinates}
                            icon={attractionIcon}
                            title={attraction.title}
                            isActive={hoveredAttraction?.id === attraction.id || selectedAttraction?.id === attraction.id}
                            attraction={attraction}
                            onMarkerClick={handleAttractionClick}
                          />
                        );
                      } else if (attraction.locations) {
                        // For attractions with multiple locations (like tavernas)
                        return attraction.locations.map((location, index) => (
                          <MarkerWithPopup
                            key={`${attraction.id}-${index}`}
                            position={location.coordinates}
                            icon={attractionIcon}
                            title={location.name}
                            isActive={hoveredAttraction?.id === attraction.id || selectedAttraction?.id === attraction.id}
                            attraction={attraction}
                            onMarkerClick={handleAttractionClick}
                          />
                        ));
                      }
                      return null;
                    })}
                  </>
                )}
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
            </MapSection>
          </ContentLayout>
        </ContentWrapper>
      </MainContent>
    </>
  );
};

export default Area;