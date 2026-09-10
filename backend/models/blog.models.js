import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true,
        trim: true 
    },
    slug: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true 
    },
    content: { 
        type: String, 
        required: true 
    }, // Quill Text Editor ka raw HTML ya delta string store karega
    metaTitle: { 
        type: String,
        trim: true 
    },
    keywords: { 
        type: String, // Form ke "Keywords" input ke liye field
        trim: true 
    },
    category: { 
        type: String, 
        required: true,
        trim: true 
    },
    metaDesc: { 
        type: String,
        trim: true 
    },
    schema: { 
        type: String // Form ke "Schema (JSON-LD)" text-area string ko store karne ke liye field
    },
    publisher: { 
        type: String, // Form ke "Publisher Name" input ke liye field
        trim: true 
    },
    coverImage: { 
        type: String 
    }, // File upload path ya fir external image URL dono handle karega
    status: {
        type: String,
        enum: ['published', 'draft'],
        default: 'published',
        index: true
    }
}, { timestamps: true });

const Blog = mongoose.model('Blog', blogSchema);
export default Blog;