import React, { useState, useEffect } from 'react';
import ConversationalAI from './components/ConversationalAI';
import TextToSpeech from './components/TextToSpeech';
import VideoAnalysis from './components/VideoAnalysis';
import { useLanguage } from './LanguageContext';

type Tab = 'conversation' | 'tts' | 'video';

const ConversationIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
    </svg>
);

const AudioIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
);

const VideoIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
    </svg>
);

const BrainIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L8 12v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1h-2v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
);


const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('conversation');
    const { language, setLanguage, t, dir } = useLanguage();

    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = dir;
    }, [language, dir]);


    const renderContent = () => {
        switch (activeTab) {
            case 'conversation':
                return <ConversationalAI />;
            case 'tts':
                return <TextToSpeech />;
            case 'video':
                return <VideoAnalysis />;
            default:
                return null;
        }
    };

    const TabButton: React.FC<{ tabName: Tab; label: string; icon: React.ReactNode }> = ({ tabName, label, icon }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-3 px-4 py-4 text-lg font-medium transition-colors duration-300 rounded-t-2xl ${
                activeTab === tabName
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-black/30 text-gray-200 flex flex-col font-tajawal">
            <header className="bg-transparent backdrop-blur-md sticky top-0 z-10">
                <div className="container mx-auto px-4 py-5 flex justify-between items-center">
                    <h1 className="text-3xl md:text-4xl font-bold text-white font-cairo flex items-center gap-3">
                        {t('header_title')} <BrainIcon className="w-8 h-8" />
                    </h1>
                    <div className="flex items-center gap-2 rtl:flex-row-reverse">
                        <button
                            onClick={() => setLanguage('en')}
                            className={`px-4 py-2 text-base font-medium rounded-xl transition-colors ${language === 'en' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/20'}`}
                        >
                            English
                        </button>
                        <button
                            onClick={() => setLanguage('ar')}
                            className={`px-4 py-2 text-base font-medium rounded-xl transition-colors ${language === 'ar' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/20'}`}
                        >
                            العربية
                        </button>
                    </div>
                </div>
            </header>
            
            <main className="flex-grow container mx-auto p-4 flex flex-col">
                <div className="bg-gray-800 rounded-3xl shadow-2xl overflow-hidden flex-grow flex flex-col border border-white/20">
                    <div className="flex border-b-2 border-white/10 bg-black/40">
                        <TabButton tabName="conversation" label={t('tab_conversation')} icon={<ConversationIcon className="w-7 h-7" />} />
                        <TabButton tabName="tts" label={t('tab_tts')} icon={<AudioIcon className="w-7 h-7" />} />
                        <TabButton tabName="video" label={t('tab_video')} icon={<VideoIcon className="w-7 h-7" />} />
                    </div>
                    <div className="p-4 sm:p-8 flex-grow overflow-y-auto">
                        {renderContent()}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;