import React from 'react';
import { Navbar } from './Navbar';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      
      {/* md:pl-64 -> Pushes content right on desktop to accommodate sidebar 
        pb-24 -> Pushes content up on mobile to accommodate bottom bar
      */}
      <main className="md:pl-64 pb-24 p-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
};