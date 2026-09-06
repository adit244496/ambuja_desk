import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

import { getISTDate } from '../utils/dateUtils';

const SLACountdownBadge = ({ deadline, status }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const [isBreached, setIsBreached] = useState(false);
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        const calculateRemaining = () => {
            const isFinished = ['closed', 'declined', 'on hold', 'on-hold'].includes(String(status || '').toLowerCase());
            if (isFinished || !deadline || String(deadline).toLowerCase() === 'nan') {
                setTimeLeft('');
                setIsBreached(false);
                setIsUrgent(false);
                return;
            }

            try {
                let targetDate = null;
                const str = String(deadline).trim();

                if (str.includes('-') || str.includes('/')) {
                    const parts = str.split(' ');
                    const dateParts = parts[0].split(/-|\//);
                    const timeParts = parts[1] ? parts[1].split(':') : [23, 59];

                    let day, month, year;
                    if (dateParts[0].length === 4) {
                        [year, month, day] = dateParts.map(Number);
                    } else {
                        [day, month, year] = dateParts.map(Number);
                    }

                    const hour = Number(timeParts[0] || 23);
                    const minute = Number(timeParts[1] || 59);

                    targetDate = new Date(year, month - 1, day, hour, minute, 59);
                } else {
                    targetDate = new Date(str);
                }

                if (!targetDate || isNaN(targetDate.getTime())) {
                    setTimeLeft('');
                    return;
                }

                const now = getISTDate();
                const diffMs = targetDate.getTime() - now.getTime();

                if (diffMs <= 0) {
                    const absDiffSec = Math.abs(Math.floor(diffMs / 1000));
                    const hours = Math.floor(absDiffSec / 3600);
                    const mins = Math.floor((absDiffSec % 3600) / 60);
                    const secs = absDiffSec % 60;

                    const timeStr = hours >= 24
                        ? `-${Math.floor(hours / 24)}d ${String(hours % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
                        : `-${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

                    setTimeLeft(timeStr);
                    setIsBreached(true);
                    setIsUrgent(false);
                } else {
                    const diffSec = Math.floor(diffMs / 1000);
                    const hours = Math.floor(diffSec / 3600);
                    const mins = Math.floor((diffSec % 3600) / 60);
                    const secs = diffSec % 60;

                    const timeStr = hours >= 24
                        ? `${Math.floor(hours / 24)}d ${String(hours % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
                        : `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

                    setTimeLeft(timeStr);
                    setIsBreached(false);
                    setIsUrgent(hours < 2);
                }
            } catch (e) {
                setTimeLeft('');
            }
        };

        calculateRemaining();
        const interval = setInterval(calculateRemaining, 1000);
        return () => clearInterval(interval);
    }, [deadline, status]);

    const isFinished = ['closed', 'declined', 'on hold', 'on-hold'].includes(String(status || '').toLowerCase());
    if (isFinished || !timeLeft) {
        return null;
    }

    const badgeStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 7px',
        borderRadius: '6px',
        fontSize: '10px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        border: '1px solid transparent',
        backgroundColor: isBreached
            ? 'rgba(239, 68, 68, 0.15)'
            : isUrgent
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(16, 185, 129, 0.15)',
        color: isBreached ? '#ef4444' : isUrgent ? '#f59e0b' : '#10b981',
        borderColor: isBreached ? 'rgba(239, 68, 68, 0.3)' : isUrgent ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'
    };

    return (
        <span style={badgeStyle} title={`SLA Countdown to Deadline (${String(deadline).split(' ')[0]})`}>
            {isBreached ? <AlertTriangle size={10} color="#ef4444" /> : <Clock size={10} color={isUrgent ? '#f59e0b' : '#10b981'} />}
            <span>{timeLeft}</span>
        </span>
    );
};

export default SLACountdownBadge;
