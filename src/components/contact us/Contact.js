import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import wtbg from '../../wtbg.png';
import GettingHere from '../getting-here/GettingHere';

const ContactSection = styled.section`
  font-family: 'BiancoSans', sans-serif;
  padding: 2.5rem 1rem;
  background: #f9f6f3;
  background-image: url(${wtbg});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: fit-content;

  @media (min-width: 768px) {
    padding: calc(60px + 2rem) clamp(20px, 5vw, 40px) 2rem;
  }
`;

const Container = styled.div`
  max-width: 48rem;
  width: 100%;
  margin: 0 auto;
  padding: 1rem;
`;

const FormContainer = styled(motion.div)`
  background: rgba(255, 255, 255, 0.95);
  padding: 2rem;
  border: 1px solid rgba(214, 108, 122, 0.2);
  transition: all 0.2s ease;
`;

const Title = styled(motion.h2)`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: normal;
  margin-bottom: 1rem;
  text-align: center;
  color: #d66c7a;
`;

const Subtitle = styled(motion.p)`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.8rem, 2vw, 0.9rem);
  text-align: center;
  margin-bottom: 1.5rem;
  color: #666;
  line-height: 1.6;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
`;

const Label = styled.label`
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  color: #666;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const RequiredIndicator = styled(motion.span)`
  color: #ff6b6b;
  font-size: clamp(0.7rem, 1.6vw, 0.8rem);
  opacity: 0.8;
`;

const Input = styled.input`
  padding: 0.75rem;
  background: white;
  border: 1px solid ${props => props.$hasError ? '#ff6b6b' : 'rgba(214, 108, 122, 0.2)'};
  color: #666;
  font-family: inherit;
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${props => props.$hasError ? '#ff6b6b' : '#d66c7a'};
  }

  &::placeholder {
    color: #999;
  }
`;

const TextArea = styled.textarea`
  padding: 0.75rem;
  background: white;
  border: 1px solid ${props => props.$hasError ? '#ff6b6b' : 'rgba(214, 108, 122, 0.2)'};
  color: #666;
  font-family: inherit;
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  min-height: 150px;
  resize: vertical;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${props => props.$hasError ? '#ff6b6b' : '#d66c7a'};
  }

  &::placeholder {
    color: #999;
  }
`;

const Button = styled.button`
  font-family: 'BiancoSans', sans-serif;
  background: transparent;
  border: 2px solid #d66c7a;
  color: #d66c7a;
  padding: 0.75rem;
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;

  &:hover {
    background: #d66c7a;
    color: white;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Message = styled(motion.div)`
  padding: 1rem;
  margin-top: 1rem;
  text-align: center;
  background: ${props => props.type === 'success' ? 'rgba(214, 108, 122, 0.1)' : 'rgba(255, 0, 0, 0.1)'};
  border: 1px solid ${props => props.type === 'success' ? 'rgba(214, 108, 122, 0.2)' : 'rgba(255, 0, 0, 0.2)'};
  color: ${props => props.type === 'success' ? '#d66c7a' : '#ff6b6b'};
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
`;

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = {};
    const fields = ['name', 'email', 'subject', 'message'];
    
    // Validate fields in clockwise order
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      await new Promise(resolve => setTimeout(resolve, 200)); // Add delay between each validation
      
      if (!formData[field]) {
        newErrors[field] = 'Required';
      } else if (field === 'email' && !validateEmail(formData.email)) {
        newErrors.email = 'Invalid email';
      }
      
      setErrors(prev => ({ ...prev, [field]: newErrors[field] }));
    }

    if (Object.keys(newErrors).length === 0) {
      // Form is valid, now we can show sending state
      setIsSubmitting(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Form submission successful
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ContactSection>
        <Container>
          <FormContainer
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Title
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              Get in Touch
            </Title>
            <Subtitle
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              Fill out the form below and we'll get back to you as soon as possible.
            </Subtitle>
            <Form onSubmit={handleSubmit} noValidate>
              <InputGroup>
                <Label htmlFor="name">
                  Name
                  <AnimatePresence>
                    {errors.name && (
                      <RequiredIndicator
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        {errors.name}
                      </RequiredIndicator>
                    )}
                  </AnimatePresence>
                </Label>
                <Input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  aria-label="Name"
                  $hasError={!!errors.name}
                  required
                />
              </InputGroup>

              <InputGroup>
                <Label htmlFor="email">
                  Email
                  <AnimatePresence>
                    {errors.email && (
                      <RequiredIndicator
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        {errors.email}
                      </RequiredIndicator>
                    )}
                  </AnimatePresence>
                </Label>
                <Input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Your email"
                  aria-label="Email"
                  $hasError={!!errors.email}
                  required
                />
              </InputGroup>

              <InputGroup>
                <Label htmlFor="subject">
                  Subject
                  <AnimatePresence>
                    {errors.subject && (
                      <RequiredIndicator
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        {errors.subject}
                      </RequiredIndicator>
                    )}
                  </AnimatePresence>
                </Label>
                <Input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Subject"
                  aria-label="Subject"
                  $hasError={!!errors.subject}
                  required
                />
              </InputGroup>

              <InputGroup>
                <Label htmlFor="message">
                  Message
                  <AnimatePresence>
                    {errors.message && (
                      <RequiredIndicator
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        {errors.message}
                      </RequiredIndicator>
                    )}
                  </AnimatePresence>
                </Label>
                <TextArea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Your message"
                  aria-label="Message"
                  $hasError={!!errors.message}
                  required
                />
              </InputGroup>

              <Button 
                type="submit" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </Button>
            </Form>
          </FormContainer>
        </Container>
      </ContactSection>
      <GettingHere />
    </>
  );
}

export default Contact;
