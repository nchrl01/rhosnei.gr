import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import styles from './BookingForm.module.css';

const BookingForm = ({ onClose }) => {
  const [formData, setFormData] = useState({
    checkIn: null,
    checkOut: null,
    name: '',
    email: '',
    details: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState({ checkIn: false, checkOut: false });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDateChange = (date, field) => {
    setFormData(prev => ({
      ...prev,
      [field]: date
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Booking request submitted successfully! We will contact you shortly.');
      
      setFormData({
        checkIn: null,
        checkOut: null,
        name: '',
        email: '',
        details: ''
      });

      if (onClose) {
        onClose();
      }
    } catch (error) {
      alert('There was an error submitting your booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDatePickerOpen = (field) => {
    setShowDatePicker(prev => ({ ...prev, [field]: true }));
  };

  const handleDatePickerClose = (field) => {
    setShowDatePicker(prev => ({ ...prev, [field]: false }));
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <>
      <button className={styles.backButton} onClick={onClose} type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back
      </button>
      <form className={styles.bookingFormContainer} onSubmit={handleSubmit}>
        <h2 className={styles.formTitle}>Book Your Stay</h2>
        <p className={styles.formSubtitle}>
          Fill out the form below to request a booking for your desired dates.
        </p>
        <div className={styles.dateRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Desired Check-in</label>
            <div className={styles.datePickerWrapper}>
              <button 
                type="button" 
                className={styles.datePickerButton}
                onClick={() => handleDatePickerOpen('checkIn')}
              >
                {formData.checkIn ? formatDate(formData.checkIn) : 'Select check-in date'}
              </button>
              <DatePicker
                selected={formData.checkIn}
                onChange={date => handleDateChange(date, 'checkIn')}
                selectsStart
                startDate={formData.checkIn}
                endDate={formData.checkOut}
                minDate={new Date()}
                dateFormat="MMMM d, yyyy"
                required
                open={showDatePicker.checkIn}
                onClickOutside={() => handleDatePickerClose('checkIn')}
                className={styles.datePicker}
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Desired Check-out</label>
            <div className={styles.datePickerWrapper}>
              <button 
                type="button" 
                className={styles.datePickerButton}
                onClick={() => handleDatePickerOpen('checkOut')}
              >
                {formData.checkOut ? formatDate(formData.checkOut) : 'Select check-out date'}
              </button>
              <DatePicker
                selected={formData.checkOut}
                onChange={date => handleDateChange(date, 'checkOut')}
                selectsEnd
                startDate={formData.checkIn}
                endDate={formData.checkOut}
                minDate={formData.checkIn || new Date()}
                dateFormat="MMMM d, yyyy"
                required
                open={showDatePicker.checkOut}
                onClickOutside={() => handleDatePickerClose('checkOut')}
                className={styles.datePicker}
              />
            </div>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Your Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Your Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Details (Optional)</label>
          <textarea
            name="details"
            value={formData.details}
            onChange={handleInputChange}
            placeholder="Any special requests or additional information..."
            className={styles.textArea}
          />
        </div>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className={styles.submitButton}
        >
          {isSubmitting ? 'Submitting...' : 'Request Booking'}
        </button>
      </form>
    </>
  );
};

export default BookingForm; 