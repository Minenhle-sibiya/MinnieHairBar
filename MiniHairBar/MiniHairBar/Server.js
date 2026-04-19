// server.js - Backend Server for Booking System
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Twilio client (if using Twilio)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// Email transporter setup
let emailTransporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    
    // Verify email connection
    emailTransporter.verify((error, success) => {
        if (error) {
            console.log('Email connection error:', error);
        } else {
            console.log('Email server is ready to send messages');
        }
    });
}

// Store bookings (in production, use a database)
let bookings = [];

// Helper functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function calculateDeposit(total) {
    return Math.ceil(total * 0.5);
}

function generateBookingId() {
    return 'BOK' + Date.now() + Math.floor(Math.random() * 1000);
}

function isTimeSlotAvailable(date, time, stylist) {
    const existingBooking = bookings.find(booking => 
        booking.date === date && 
        booking.time === time && 
        (booking.stylist === stylist || stylist === 'any')
    );
    return !existingBooking;
}

function getAvailableTimeSlots(date, stylist) {
    const allTimes = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
        '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
    ];
    
    const bookedTimes = bookings
        .filter(booking => booking.date === date && 
            (booking.stylist === stylist || stylist === 'any'))
        .map(booking => booking.time);
    
    return allTimes.filter(time => !bookedTimes.includes(time));
}

// Send Email
async function sendBookingEmail(bookingData) {
    if (!emailTransporter) {
        console.log('Email not configured');
        return false;
    }
    
    const deposit = calculateDeposit(bookingData.total);
    const formattedDate = formatDate(bookingData.date);
    
    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #ff6b6b, #ff8e8e); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff6b6b; }
                .service-item { padding: 8px 0; border-bottom: 1px solid #eee; }
                .total { font-size: 18px; font-weight: bold; color: #ff6b6b; margin-top: 15px; padding-top: 15px; border-top: 2px solid #eee; }
                .deposit { background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Booking Confirmed! ✨</h1>
                <p>Thank you for choosing our services</p>
            </div>
            <div class="content">
                <h2>Hello ${bookingData.fullName},</h2>
                <p>Your appointment has been successfully booked. Here are your details:</p>
                
                <div class="booking-details">
                    <h3>📅 Appointment Details</h3>
                    <p><strong>Date:</strong> ${formattedDate}</p>
                    <p><strong>Time:</strong> ${bookingData.time}</p>
                    <p><strong>Stylist:</strong> ${bookingData.stylist === 'any' ? 'Any Available' : bookingData.stylist}</p>
                    
                    <h3>💇 Services Selected:</h3>
                    ${bookingData.services.map(service => `
                        <div class="service-item">
                            <strong>${service.name}</strong> - R${service.price}
                        </div>
                    `).join('')}
                    
                    <div class="total">
                        Total Amount: R${bookingData.total}
                    </div>
                </div>
                
                <div class="deposit">
                    <strong>💰 Deposit Required: R${deposit} (50%)</strong><br>
                    <p>Please make payment to secure your booking:</p>
                    <p><strong>Capitec Bank</strong><br>
                    Account Number: 1712117716<br>
                    Branch Code: 250655<br>
                    Reference: ${bookingData.bookingId}</p>
                    <p><small>Balance of R${bookingData.total - deposit} payable on arrival</small></p>
                </div>
                
                <div class="footer">
                    <p>Questions? Contact us: 073 378 7984</p>
                    <p>This is a confirmation email. Please keep it for your records.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const mailOptions = {
        from: `"Salon Booking" <${process.env.EMAIL_USER}>`,
        to: bookingData.email,
        subject: `Booking Confirmed - ${bookingData.bookingId}`,
        html: emailHtml
    };
    
    try {
        await emailTransporter.sendMail(mailOptions);
        console.log(`Email sent to ${bookingData.email}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

// Send SMS
async function sendSMS(bookingData) {
    if (!twilioClient) {
        console.log('SMS not configured');
        return false;
    }
    
    const deposit = calculateDeposit(bookingData.total);
    const formattedDate = formatDate(bookingData.date);
    
    const smsMessage = `
Salon Booking Confirmed! 🎉
${bookingData.fullName}, your appointment is confirmed for ${formattedDate} at ${bookingData.time}
Services: ${bookingData.services.map(s => s.name).join(', ')}
Total: R${bookingData.total}
Deposit: R${deposit} (50%)
Bank: Capitec, Acc: 1712117716, Ref: ${bookingData.bookingId}
Questions? Call 073 378 7984
    `.trim();
    
    try {
        await twilioClient.messages.create({
            body: smsMessage,
            to: bookingData.phone,
            from: process.env.TWILIO_PHONE_NUMBER
        });
        console.log(`SMS sent to ${bookingData.phone}`);
        return true;
    } catch (error) {
        console.error('Error sending SMS:', error);
        return false;
    }
}

// API Endpoints

// Check availability
app.post('/api/check-availability', (req, res) => {
    const { date, stylist } = req.body;
    const availableTimes = getAvailableTimeSlots(date, stylist || 'any');
    
    res.json({
        success: true,
        availableTimes: availableTimes
    });
});

// Create booking
app.post('/api/book-appointment', async (req, res) => {
    try {
        const bookingData = req.body;
        
        // Validate required fields
        if (!bookingData.fullName || !bookingData.phone || !bookingData.email || 
            !bookingData.date || !bookingData.time || !bookingData.services) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Check availability
        const isAvailable = isTimeSlotAvailable(bookingData.date, bookingData.time, bookingData.stylist);
        if (!isAvailable) {
            return res.status(409).json({
                success: false,
                message: 'This time slot is no longer available. Please select another time.'
            });
        }
        
        // Generate booking ID
        const bookingId = generateBookingId();
        
        // Calculate totals
        const total = bookingData.services.reduce((sum, service) => sum + service.price, 0);
        const deposit = calculateDeposit(total);
        
        // Create booking object
        const newBooking = {
            bookingId: bookingId,
            ...bookingData,
            total: total,
            deposit: deposit,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        // Store booking
        bookings.push(newBooking);
        
        // Send email and SMS
        const [emailSent, smsSent] = await Promise.all([
            sendBookingEmail(newBooking),
            sendSMS(newBooking)
        ]);
        
        // Return success response
        res.status(201).json({
            success: true,
            message: 'Booking confirmed!',
            bookingId: bookingId,
            bookingDetails: {
                id: bookingId,
                total: total,
                deposit: deposit,
                emailSent: emailSent,
                smsSent: smsSent
            }
        });
        
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process booking. Please try again.',
            error: error.message
        });
    }
});

// Get all bookings (admin)
app.get('/api/bookings', (req, res) => {
    res.json({
        success: true,
        bookings: bookings
    });
});

// Cancel booking
app.post('/api/cancel-booking/:bookingId', (req, res) => {
    const bookingIndex = bookings.findIndex(b => b.bookingId === req.params.bookingId);
    
    if (bookingIndex === -1) {
        return res.status(404).json({
            success: false,
            message: 'Booking not found'
        });
    }
    
    bookings[bookingIndex].status = 'cancelled';
    
    res.json({
        success: true,
        message: 'Booking cancelled successfully'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 Email: ${emailTransporter ? 'Configured ✓' : 'Not configured'}`);
    console.log(`💬 SMS: ${twilioClient ? 'Configured ✓' : 'Not configured'}`);
});