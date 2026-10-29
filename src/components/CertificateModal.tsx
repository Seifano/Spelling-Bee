import React from 'react';
import { Award, Printer, X } from 'lucide-react';
import { AppSettings } from '../types';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  classSec: string;
  score: number;
  totalWords: number;
  settings: AppSettings;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  studentName,
  classSec,
  score,
  totalWords,
  settings,
}) => {
  if (!isOpen) return null;

  const isQualifier = score >= 2;
  const isPerfect = score === totalWords;
  const grade = classSec.split('-')[0];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-10 max-w-2xl w-full shadow-2xl space-y-6 max-h-[95vh] overflow-y-auto relative print:p-0 print:shadow-none print:max-w-none print:w-full print:border-none">
        
        {/* Close Button (hidden in print) */}
        <div className="flex justify-between items-center print:hidden border-b pb-3 border-slate-200">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Official Award Certificate Preview
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Printable Certificate Frame */}
        <div className="border-8 border-double border-amber-600/60 p-8 sm:p-12 text-center rounded-2xl bg-amber-50/20 relative overflow-hidden shadow-inner print:border-8 print:p-8">
          
          {/* Official School Crest Logo */}
          <div className="flex justify-center mb-3">
            <img
              src="/assets/aistudio/Asset-2-2_69f00ddc.png"
              alt="School Logo"
              className="w-16 h-16 object-contain"
            />
          </div>

          <div className="text-xs uppercase tracking-widest font-bold text-amber-800/80 mb-1">
            {settings.school || "Adhwa'a Al-Hedaya International Schools"}
          </div>

          <div className="text-xs text-slate-500 uppercase tracking-widest mb-6">
            Spelling Bee Championship · Academic Year 2026–2027
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 uppercase font-serif mb-2">
            {isQualifier ? 'Certificate of Qualification' : 'Certificate of Achievement'}
          </h1>

          <div className="text-xs text-slate-500 italic mb-6">
            This certifies that
          </div>

          <div className="text-3xl sm:text-4xl font-extrabold text-blue-950 border-b-2 border-slate-300 pb-2 mb-4 mx-auto max-w-md font-serif capitalize">
            {studentName || 'Distinguished Student'}
          </div>

          <div className="text-sm text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
            has demonstrated exceptional spelling accuracy and orthographic distinction representing{' '}
            <strong className="text-slate-900 font-semibold">Class {classSec}</strong> in Grade {grade}, achieving an official score of{' '}
            <strong className="text-slate-900 font-bold">{score} out of {totalWords}</strong>.
            {isQualifier && (
              <div className="mt-2 text-amber-800 font-bold text-sm">
                ★ Officially Qualified for the Grand Championship Final ★
              </div>
            )}
          </div>

          {/* Seals & Signatures */}
          <div className="flex items-center justify-between pt-8 border-t border-slate-200 max-w-lg mx-auto">
            <div className="text-center w-36">
              <div className="border-b border-slate-400 pb-1 text-xs font-mono text-slate-500">
                {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="text-[10px] uppercase text-slate-400 font-semibold mt-1">Date</div>
            </div>

            {/* Gold Seal Emblem */}
            <div className="w-16 h-16 rounded-full border-4 border-amber-500 bg-amber-100 flex flex-col items-center justify-center text-amber-800 shadow-md transform rotate-6">
              <Award className="w-7 h-7 text-amber-600" />
              <span className="text-[8px] font-black uppercase tracking-tighter">OFFICIAL</span>
            </div>

            <div className="text-center w-36">
              <div className="border-b border-slate-400 pb-1 text-xs font-serif italic text-slate-700">
                Spelling Bee Committee
              </div>
              <div className="text-[10px] uppercase text-slate-400 font-semibold mt-1">Adjudicator</div>
            </div>
          </div>
        </div>

        {/* Print Action Bar (hidden in print) */}
        <div className="flex justify-end gap-3 pt-2 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold text-xs hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
