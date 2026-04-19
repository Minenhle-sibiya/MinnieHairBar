// script.js - Complete Booking System with Backend Integration

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) {
        dateInput.setAttribute('min', today);
    }
    
    // Selected services array
    let selectedServices = [];
    
    // DOM Elements
    const selectButtons = document.querySelectorAll('.select-service');
    const selectedItemsContainer = document.getElementById('selectedItems');
    const totalPriceElement = document.getElementById('totalPrice');
    const itemCountElement = document.querySelector('.item-count');
    const btnTotal = document.getElementById('btnTotal');
    const bookNowBtn = document.getElementById('bookNowBtn');
    const appointmentForm = document.getElementById('appointmentForm');
    const timeSelect = document.getElementById('appointmentTime');
    const stylistSelect = document.getElementById('stylist');
    
    // ==================== UTILITY FUNCTIONS ====================
    
    // Format price in Rands
    function formatRands(amount) {
        return 'R' + amount;
    }
    
    // Calculate total price
    function calculateTotal() {
        return selectedServices.reduce((sum, service) => sum + service.price, 0);
    }
    
    // Calculate deposit (50%)
    function calculateDeposit() {
        return Math.ceil(calculateTotal() * 0.5);
    }
    
    // ==================== UI UPDATE FUNCTIONS ====================
    
    // Update selected services display
    function updateSelectedServices() {
        if (!selectedItemsContainer) return;
        
        if (selectedServices.length === 0) {
            selectedItemsContainer.innerHTML = '<p class="empty-selection">No services selected yet</p>';
            if (totalPriceElement) totalPriceElement.textContent = 'Total: R0';
            if (itemCountElement) itemCountElement.textContent = '(0)';
            if (btnTotal) btnTotal.textContent = '';
            if (bookNowBtn) bookNowBtn.disabled = true;
            return;
        }
        
        let html = '';
        let total = 0;
        
        selectedServices.forEach((service, index) => {
            total += service.price;
            html += `
                <div class="selected-item" data-service-index="${index}">
                    <span class="selected-item-name">${escapeHtml(service.name)}</span>
                    <span>
                        <span class="selected-item-price">R${service.price}</span>
                        <button class="remove-item" data-index="${index}" aria-label="Remove ${escapeHtml(service.name)}">✕</button>
                    </span>
                </div>
            `;
        });
        
        selectedItemsContainer.innerHTML = html;
        if (totalPriceElement) totalPriceElement.textContent = `Total: R${total}`;
        if (itemCountElement) itemCountElement.textContent = `(${selectedServices.length})`;
        
        // Show deposit amount (50%)
        const deposit = calculateDeposit();
        if (btnTotal) btnTotal.textContent = `(50% deposit: R${deposit})`;
        if (bookNowBtn) bookNowBtn.disabled = false;
        
        // Add remove functionality
        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const index = parseInt(this.dataset.index);
                if (!isNaN(index)) {
                    selectedServices.splice(index, 1);
                    updateSelectedServices();
                    updateServiceButtons();
                }
            });
        });
    }
    
    // Update service button states
    function updateServiceButtons() {
        selectButtons.forEach(btn => {
            const serviceName = btn.dataset.service;
            if (selectedServices.some(s => s.name === serviceName)) {
                btn.classList.add('selected');
                btn.textContent = 'Selected ✓';
                btn.disabled = true;
            } else {
                btn.classList.remove('selected');
                btn.textContent = 'Select';
                btn.disabled = false;
            }
        });
    }
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ==================== AVAILABILITY CHECK ====================
    
    // Check available time slots
    async function checkAvailability() {
        if (!dateInput || !timeSelect || !stylistSelect) return;
        
        const date = dateInput.value;
        const stylist = stylistSelect.value;
        
        if (!date) return;
        
        try {
            // Show loading state
            timeSelect.disabled = true;
            timeSelect.innerHTML = '<option value="">Checking availability...</option>';
            
            const response = await fetch(`${API_URL}/check-availability`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ date, stylist })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Reset time select options
                const defaultOption = '<option value="">Choose a time</option>';
                const timeOptions = [
                    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
                    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
                    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
                ];
                
                let optionsHtml = defaultOption;
                timeOptions.forEach(time => {
                    const isAvailable = data.availableTimes.includes(time);
                    optionsHtml += `<option value="${time}" ${!isAvailable ? 'disabled' : ''}>${formatTimeDisplay(time)}</option>`;
                });
                
                timeSelect.innerHTML = optionsHtml;
                timeSelect.disabled = false;
                
                // Show message if no slots available
                if (data.availableTimes.length === 0) {
                    showNotification('No available time slots for this date. Please choose another date.', 'warning');
                }
            }
        } catch (error) {
            console.error('Error checking availability:', error);
            timeSelect.innerHTML = '<option value="">Error loading times</option>';
            timeSelect.disabled = false;
            showNotification('Unable to check availability. Please try again.', 'error');
        }
    }
    
    // Format time for display
    function formatTimeDisplay(time) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    }
    
    // ==================== NOTIFICATION SYSTEM ====================
    
    // Show notification
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
                <span class="notification-message">${escapeHtml(message)}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#ff9800'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            min-width: 300px;
            max-width: 500px;
        `;
        
        document.body.appendChild(notification);
        
        // Close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            margin-left: 15px;
            padding: 0 5px;
        `;
        
        closeBtn.onclick = () => notification.remove();
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // ==================== FORM VALIDATION ====================
    
    // Validate form inputs
    function validateForm() {
        const fullName = document.getElementById('fullName')?.value.trim();
        const phone = document.getElementById('phone')?.value.trim();
        const email = document.getElementById('email')?.value.trim();
        const date = document.getElementById('appointmentDate')?.value;
        const time = document.getElementById('appointmentTime')?.value;
        
        if (!fullName) {
            showNotification('Please enter your full name', 'error');
            return false;
        }
        
        if (!phone) {
            showNotification('Please enter your phone number', 'error');
            return false;
        }
        
        // Validate South African phone number
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
            showNotification('Please enter a valid 10-digit phone number (e.g., 0712345678)', 'error');
            return false;
        }
        
        if (!email) {
            showNotification('Please enter your email address', 'error');
            return false;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNotification('Please enter a valid email address', 'error');
            return false;
        }
        
        if (!date) {
            showNotification('Please select a date', 'error');
            return false;
        }
        
        if (!time) {
            showNotification('Please select a time', 'error');
            return false;
        }
        
        return true;
    }
    
    // ==================== BOOKING SUBMISSION ====================
    
    // Set loading state
    function setLoading(isLoading) {
        const submitBtn = document.querySelector('.book-now-btn');
        if (!submitBtn) return;
        
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Processing...</span>';
        } else {
            submitBtn.disabled = false;
            const total = calculateTotal();
            const deposit = calculateDeposit();
            submitBtn.innerHTML = `
                <span>Confirm Booking</span>
                <span class="btn-total">(50% deposit: R${deposit})</span>
            `;
        }
    }
    
    // Submit booking
    async function submitBooking(formData) {
        try {
            const response = await fetch(`${API_URL}/book-appointment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Show success message with booking details
                let paymentMessage = '';
                if (formData.paymentMethod === 'eft') {
                    paymentMessage = `\n\nPlease make EFT payment of R${result.bookingDetails.deposit} to:\n\nCapitec Bank\nAccount: 1712117716\nBranch: 250655\nReference: ${result.bookingId}\n\n`;
                }
                
                const successMessage = `✅ BOOKING CONFIRMED!\n\nBooking ID: ${result.bookingId}${paymentMessage}\nA confirmation email and SMS have been sent to ${formData.email}.\n\nPlease check your inbox (including spam folder) for details.\n\nThank you for choosing us! ✨`;
                
                alert(successMessage);
                
                // Reset form
                appointmentForm.reset();
                selectedServices = [];
                updateSelectedServices();
                updateServiceButtons();
                
                // Reset date picker
                if (dateInput) dateInput.value = '';
                if (timeSelect) timeSelect.innerHTML = '<option value="">Choose a time</option>';
                
                return true;
            } else {
                throw new Error(result.message || 'Booking failed');
            }
        } catch (error) {
            console.error('Booking error:', error);
            showNotification(error.message || 'Unable to process booking. Please try again.', 'error');
            return false;
        }
    }
    
    // ==================== EVENT LISTENERS ====================
    
    // Service selection
    if (selectButtons) {
        selectButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const serviceName = this.dataset.service;
                const price = parseInt(this.dataset.price);
                
                if (!serviceName || isNaN(price)) {
                    console.error('Invalid service data');
                    return;
                }
                
                // Check if already selected
                const existingIndex = selectedServices.findIndex(s => s.name === serviceName);
                
                if (existingIndex === -1) {
                    // Add new service
                    selectedServices.push({
                        name: serviceName,
                        price: price
                    });
                    showNotification(`${serviceName} added to your booking`, 'success');
                } else {
                    // Remove if already selected
                    selectedServices.splice(existingIndex, 1);
                    showNotification(`${serviceName} removed from your booking`, 'info');
                }
                
                updateSelectedServices();
                updateServiceButtons();
            });
        });
    }
    
    // Date change event
    if (dateInput) {
        dateInput.addEventListener('change', function() {
            checkAvailability();
        });
    }
    
    // Stylist change event
    if (stylistSelect) {
        stylistSelect.addEventListener('change', function() {
            if (dateInput && dateInput.value) {
                checkAvailability();
            }
        });
    }
    
    // Form submission
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Check if services are selected
            if (selectedServices.length === 0) {
                showNotification('Please select at least one service', 'error');
                return;
            }
            
            // Validate form
            if (!validateForm()) {
                return;
            }
            
            // Get payment method
            const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'eft';
            
            // Prepare booking data
            const bookingData = {
                fullName: document.getElementById('fullName').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                email: document.getElementById('email').value.trim(),
                stylist: document.getElementById('stylist').value,
                date: document.getElementById('appointmentDate').value,
                time: document.getElementById('appointmentTime').value,
                notes: document.getElementById('notes')?.value.trim() || '',
                services: selectedServices,
                total: calculateTotal(),
                paymentMethod: paymentMethod
            };
            
            // Submit booking
            setLoading(true);
            const success = await submitBooking(bookingData);
            setLoading(false);
            
            if (!success) {
                showNotification('Booking failed. Please try again or contact us directly.', 'error');
            }
        });
    }
    
    // Initialize service buttons state
    updateServiceButtons();
    
    console.log('Booking system initialized');
});