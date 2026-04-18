const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());

// make sure uploads folder exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.get('/', (req, res) => {
    res.render('home');
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/request', (req, res) => {
    res.render('request', { errors: [], formData: {} });
});

app.post('/request', async (req, res) => {
    const { fullName, studentId, email, program, serviceType, urgency, description, contactMethod } = req.body;
    const errors = [];

    if (!fullName || fullName.trim() === '') errors.push('Full name is required.');
    if (!studentId || studentId.trim() === '') {
        errors.push('Student ID is required.');
    } else if (!/^\d{3}-\d{3}-\d{4}$/.test(studentId.trim())) {
        errors.push('Student ID must be in the format XXX-XXX-XXXX (digits only).');
    }
    if (!email || email.trim() === '') {
        errors.push('Email address is required.');
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
        errors.push('Please enter a valid email address.');
    }
    if (!program || program.trim() === '') errors.push('Program name is required.');
    if (!serviceType || serviceType === '') errors.push('Please select a service type.');
    if (!urgency || urgency === '') errors.push('Please select an urgency level.');
    if (!description || description.trim() === '') errors.push('Request description is required.');
    if (!contactMethod || contactMethod === '') errors.push('Please select a preferred contact method.');

    if (!req.files || !req.files.studentCard) {
        errors.push('Please upload your student card image.');
    } else {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(req.files.studentCard.mimetype)) {
            errors.push('Student card must be a JPG or PNG image.');
        }
    }

    if (errors.length > 0) {
        return res.render('request', { errors, formData: req.body });
    }

    // save the uploaded file
    const cardFile = req.files.studentCard;
    const ext = path.extname(cardFile.name);
    const savedName = 'card_' + Date.now() + ext;
    const savePath = path.join(uploadsDir, savedName);

    try {
        await cardFile.mv(savePath);
    } catch (err) {
        return res.render('request', { errors: ['File upload failed. Please try again.'], formData: req.body });
    }

    // generate request number
    const reqNum = 'SR-' + Math.floor(1000 + Math.random() * 9000);

    // response time and fee based on service type
    let responseTime = '';
    let fee = '';
    let statusMsg = '';

    if (serviceType === 'id_card') {
        responseTime = '1 – 3 business days';
        fee = '$25.00';
        statusMsg = 'Your ID card replacement request has been received and is being processed.';
    } else if (serviceType === 'enrollment_letter') {
        responseTime = '2 – 3 business days';
        fee = '$10.00';
        statusMsg = 'Your enrollment letter request is queued and will be emailed to you.';
    } else if (serviceType === 'timetable_help') {
        responseTime = 'Same day or next business day';
        fee = 'No charge';
        statusMsg = 'An academic advisor will reach out to you shortly.';
    } else {
        responseTime = '3 – 5 business days';
        fee = 'To be determined';
        statusMsg = 'Your request has been received and will be reviewed.';
    }

    const submittedAt = new Date().toLocaleString('en-CA', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const urgencyLabel = urgency === 'high' ? 'High' : urgency === 'medium' ? 'Medium' : 'Low';

    const serviceLabel = {
        id_card: 'ID Card Replacement',
        enrollment_letter: 'Enrollment Letter',
        timetable_help: 'Timetable Help / Academic Support'
    }[serviceType] || serviceType;

    const summary = `${fullName.trim()} submitted a ${serviceLabel} request on ${submittedAt}. ` +
        `Request ${reqNum} has been assigned with ${urgencyLabel} urgency. ` +
        `Estimated response: ${responseTime}. ${statusMsg}`;

    const result = {
        reqNum,
        fullName: fullName.trim(),
        studentId: studentId.trim(),
        email: email.trim(),
        program: program.trim(),
        serviceType: serviceLabel,
        urgency: urgencyLabel,
        description: description.trim(),
        contactMethod,
        cardImage: '/uploads/' + savedName,
        responseTime,
        fee,
        statusMsg,
        submittedAt,
        summary
    };

    res.render('result', { result });
});

app.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
});
