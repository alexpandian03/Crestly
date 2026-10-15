import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

export default function DraftRestoreDialog({
  isOpen,
  savedAt,
  onContinue,
  onDiscard,
}) {
  if (!isOpen) return null;

  const formattedTime = savedAt
    ? new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const formattedDate = savedAt
    ? new Date(savedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : '';
  const timeString = formattedDate && formattedTime ? `${formattedDate} at ${formattedTime}` : 'earlier';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onDiscard(); }}>
      <DialogContent className="max-w-md bg-white p-6 rounded-[8px] shadow-lg border border-[#E5E7EB]">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg font-semibold text-[#111827]">
            Continue your draft?
          </DialogTitle>
          <DialogDescription className="text-sm text-[#4B5563]">
            You have unsaved work from {timeString}. Would you like to continue where you left off or start fresh?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onDiscard}
            className="h-9 px-4 rounded-[6px] border-[#D1D5DB] text-xs font-medium text-[#374151] hover:bg-slate-50"
          >
            Discard draft
          </Button>
          <Button
            type="button"
            onClick={onContinue}
            className="h-9 px-4 rounded-[6px] bg-[#2563EB] text-xs font-medium text-white hover:bg-[#1D4ED8]"
          >
            Continue your draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
