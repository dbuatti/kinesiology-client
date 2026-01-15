"use client";

import React from 'react';
import ActiveSession from './ActiveSession';

// Use a valid UUID format for the mock appointment ID
const MOCK_APPOINTMENT_ID = '00000000-0000-0000-0000-000000000000';

const DebugZone = () => {
  return (
    <ActiveSession mockAppointmentId={MOCK_APPOINTMENT_ID} />
  );
};

export default DebugZone;