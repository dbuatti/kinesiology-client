"use client";

import React from 'react';
import ActiveSession from './ActiveSession';

const MOCK_APPOINTMENT_ID = 'debug-session-id';

const DebugZone = () => {
  return (
    <ActiveSession mockAppointmentId={MOCK_APPOINTMENT_ID} />
  );
};

export default DebugZone;