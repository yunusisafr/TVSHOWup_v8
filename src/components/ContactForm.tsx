import React, { useState } from 'react'
import { Send, AlertCircle, CheckCircle } from 'lucide-react'
import { useUserPreferences } from '../contexts/UserPreferencesContext'
import { useTranslation } from '../lib/i18n'
import { supabase } from '../lib/supabase'

interface ContactFormProps {
  onSubmitSuccess?: () => void
}

const ContactForm: React.FC<ContactFormProps> = ({ onSubmitSuccess }) => {
  const { languageCode } = useUserPreferences()
  const { t } = useTranslation(languageCode)
  
  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError(languageCode === 'tr' 
        ? 'Lütfen tüm gerekli alanları doldurun.' 
        : 'Please fill in all required fields.')
      return
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError(languageCode === 'tr'
        ? 'Lütfen geçerli bir e-posta adresi girin.'
        : 'Please enter a valid email address.')
      return
    }
    
    try {
      setLoading(true)
      setError(null)

      const { error: insertError } = await supabase
        .from('contact_messages')
        .insert([
          {
            name: name.trim(),
            email: email.trim(),
            subject: subject.trim() || null,
            message: message.trim(),
          }
        ])

      if (insertError) {
        throw insertError
      }

      setSuccess(true)

      setName('')
      setEmail('')
      setSubject('')
      setMessage('')

      if (onSubmitSuccess) {
        onSubmitSuccess()
      }

      setTimeout(() => {
        setSuccess(false)
      }, 5000)

    } catch (error) {
      console.error('Error submitting contact form:', error instanceof Error ? error.message : error)
      setError(languageCode === 'tr'
        ? 'Mesaj gönderilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
        : 'An error occurred while sending your message. Please try again later.')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg" id="contact-form">
      <h2 className="text-2xl font-bold text-white mb-6">
        {t.contactUs}
      </h2>
      
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-red-400">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-500 rounded-lg flex items-start">
          <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-green-400">
            {languageCode === 'tr' 
              ? 'Mesajınız alındı. En kısa sürede size geri dönüş yapacağız.' 
              : 'Your message has been received. We will get back to you as soon as possible.'}
          </p>
        </div>
      )}
      
      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        
        {/* Name */}
        <div>
          <label htmlFor="user_name" className="block text-sm font-medium text-gray-300 mb-1">
            {languageCode === 'tr' ? 'Adınız' : 'Your Name'} <span className="text-red-400">*</span>
          </label>
          <input
            id="user_name"
            name="user_name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={languageCode === 'tr' ? 'Adınız Soyadınız' : 'Your full name'}
            required
          />
        </div>
        
        {/* Email */}
        <div>
          <label htmlFor="user_email" className="block text-sm font-medium text-gray-300 mb-1">
            {languageCode === 'tr' ? 'E-posta Adresiniz' : 'Your Email'} <span className="text-red-400">*</span>
          </label>
          <input
            id="user_email"
            name="user_email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={languageCode === 'tr' ? 'ornek@email.com' : 'example@email.com'}
            required
          />
        </div>
        
        {/* Subject */}
        <div>
          <label htmlFor="subject_line" className="block text-sm font-medium text-gray-300 mb-1">
            {languageCode === 'tr' ? 'Konu' : 'Subject'}
          </label>
          <input
            id="subject_line"
            name="subject_line"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={languageCode === 'tr' ? 'Mesajınızın konusu' : 'Subject of your message'}
          />
        </div>
        
        {/* Message */}
        <div>
          <label htmlFor="message_content" className="block text-sm font-medium text-gray-300 mb-1">
            {languageCode === 'tr' ? 'Mesajınız' : 'Your Message'} <span className="text-red-400">*</span>
          </label>
          <textarea
            id="message_content"
            name="message_content"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[150px]"
            placeholder={languageCode === 'tr' ? 'Mesajınızı buraya yazın...' : 'Write your message here...'}
            required
          />
        </div>
        
        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={loading}
            className="bg-primary-500 hover:bg-primary-600 text-white py-2 px-6 rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                {languageCode === 'tr' ? 'Gönderiliyor...' : 'Sending...'}
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                {t.submit}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ContactForm