import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        trim: true,
        default: ''
    },
    address: {
        type: String,
        trim: true,
        default: ''
    },
    source: {
        type: String,
        trim: true,
        default: 'website'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Lead = mongoose.model('Lead', leadSchema);
export default Lead;
