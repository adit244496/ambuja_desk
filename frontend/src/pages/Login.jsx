// frontend/src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, resetFirstPassword } from '../api';
import { Mail, Lock, Eye, EyeOff, LogIn, KeyRound } from 'lucide-react';
import logoImg from '../assets/logo.png';

const Login = ({ setUser }) => {
    const navigate = useNavigate();

    // Standard Login State
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    // First-Time Reset State
    const [isForceReset, setIsForceReset] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Slideshow State
    const [bgIndex, setBgIndex] = useState(0);
    const backgroundImages = [
        "/login_images/login_image_1.jpeg",
        "/login_images/login_image_2.jpeg",
        "/login_images/login_image_3.jpeg",
        "/login_images/login_image_4.jpeg",
        "/login_images/login_image_5.jpeg",
        "/login_images/login_image_6.jpeg",
        "/login_images/login_image_7.jpeg",
        "/login_images/login_image_8.jpeg",
        "/login_images/login_image_9.jpeg"
    ];

    React.useEffect(() => {
        const interval = setInterval(() => {
            setBgIndex(prev => (prev + 1) % backgroundImages.length);
        }, 5000); // Change image every 5 seconds
        return () => clearInterval(interval);
    }, [backgroundImages.length]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const data = await loginUser({ login_id: loginId, password });

            if (data.force_reset) {
                setIsForceReset(true);
                setResetEmail(data.email);
            } else {
                sessionStorage.setItem('ticket_user', JSON.stringify(data.user));
                setUser(data.user);

                if (data.user.role === 'Admin' || data.user.role === 'Superadmin' || data.user.role === 'Super Admin') navigate('/admin');
                else if (data.user.role === 'User') navigate('/user');
                else if (data.user.role === 'Viewer') navigate('/viewer');
                else navigate('/user');
            }
        } catch (err) {
            setError(err.response?.data?.error || "Login failed. Please try again.");
        }
    };

    const handleForceReset = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            return setError("Passwords do not match.");
        }
        if (newPassword.length < 8) {
            return setError("Password must be at least 8 characters.");
        }

        try {
            await resetFirstPassword({ email: resetEmail, current_password: password, new_password: newPassword });
            alert("Password reset successfully! Please log in with your new password.");
            setIsForceReset(false);
            setPassword('');
        } catch (err) {
            setError(err.response?.data?.error || "Reset failed.");
        }
    };

    return (
        <div className="login-root-container">
            {/* LEFT SIDE: SPLIT SCREEN VISUAL WITH SLIDESHOW (Desktop/Tablet) */}
            <div className="login-left-pane">
                {backgroundImages.map((imgUrl, index) => (
                    <div
                        key={index}
                        className="login-bg-slide"
                        style={{
                            backgroundImage: `url("${imgUrl}")`,
                            opacity: index === bgIndex ? 1 : 0
                        }}
                    ></div>
                ))}
                <div className="login-left-overlay"></div>
                <div className="login-left-content">
                    <div className="login-branding">
                        <img src={logoImg} alt="Ambuja Neotia Logo" className="login-brand-logo" />
                        <p className="login-brand-tagline">Making a difference to the way people live</p>
                    </div>
                    <div className="login-quote-box">
                        <p className="login-quote-text">
                            "Our key purpose is to be happy and put a smile on everyone's face, whether it's our customers, employees or contractors."
                        </p>
                        <p className="login-quote-author">- Harshavardhan Neotia</p>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE: LOGIN FORM */}
            <div className="login-right-pane">
                <div className="login-form-wrapper">
                    {/* MOBILE BRAND LOGO (Shown only on small screens) */}
                    <div className="login-mobile-header">
                        <img src={logoImg} alt="Ambuja Neotia Logo" className="login-mobile-logo" />
                    </div>

                    {/* HEADER SECTION */}
                    <div className="login-header-block">
                        <h2 className="login-title">Ambuja Desk</h2>
                        <p className="login-subtitle">Enterprise Ticketing Portal</p>
                    </div>

                    {error && (
                        <div className="login-error-box">
                            {error}
                        </div>
                    )}

                    {/* LOGIN FORM */}
                    {!isForceReset ? (
                        <form onSubmit={handleLogin} className="login-form">
                            <div className="login-input-group">
                                <label className="login-label">Email Address or Phone</label>
                                <div className="login-input-wrapper">
                                    <Mail size={17} color="#9ca3af" className="login-input-icon" />
                                    <input
                                        type="text"
                                        className="login-input-field"
                                        placeholder="Enter your email or phone"
                                        value={loginId}
                                        onChange={(e) => setLoginId(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="login-input-group">
                                <label className="login-label">Password</label>
                                <div className="login-input-wrapper">
                                    <Lock size={17} color="#9ca3af" className="login-input-icon" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="login-input-field"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="login-password-toggle"
                                        aria-label="Toggle password visibility"
                                    >
                                        {showPassword ? <EyeOff size={17} color="#9ca3af" /> : <Eye size={17} color="#9ca3af" />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" className="login-submit-btn">
                                <LogIn size={17} /> Sign In
                            </button>
                        </form>
                    ) : (
                        /* FORCE RESET FORM */
                        <form onSubmit={handleForceReset} className="login-form">
                            <div className="login-warning-box">
                                <strong>First Login Detected.</strong><br />
                                Please set a secure password to continue.
                            </div>

                            <div className="login-input-group">
                                <label className="login-label">New Password (Min 8 chars)</label>
                                <div className="login-input-wrapper">
                                    <KeyRound size={17} color="#9ca3af" className="login-input-icon" />
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        className="login-input-field"
                                        placeholder="Create new password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="login-password-toggle"
                                    >
                                        {showNewPassword ? <EyeOff size={17} color="#9ca3af" /> : <Eye size={17} color="#9ca3af" />}
                                    </button>
                                </div>
                            </div>

                            <div className="login-input-group">
                                <label className="login-label">Confirm Password</label>
                                <div className="login-input-wrapper">
                                    <Lock size={17} color="#9ca3af" className="login-input-icon" />
                                    <input
                                        type="password"
                                        className="login-input-field"
                                        placeholder="Confirm new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <button type="submit" className="login-submit-btn">
                                <KeyRound size={17} /> Update Password
                            </button>
                        </form>
                    )}

                    <div className="login-footer">
                        &copy; {new Date().getFullYear()} Ambuja Neotia Group. All rights reserved.
                    </div>
                </div>
            </div>

            {/* SCOPED COMPONENT STYLES */}
            <style>{`
                .login-root-container {
                    display: flex;
                    height: 125vh;
                    min-height: 125vh;
                    width: 125vw;
                    background-color: #ffffff;
                    font-family: 'Montserrat', 'Inter', sans-serif;
                    overflow: hidden;
                    position: relative;
                }

                .login-left-pane {
                    flex: 7;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justifyContent: center;
                    padding: 60px;
                    overflow: hidden;
                    -webkit-mask-image: linear-gradient(to right, black 95%, transparent 100%);
                    mask-image: linear-gradient(to right, black 95%, transparent 100%);
                }

                .login-bg-slide {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-size: cover;
                    background-position: center;
                    transition: opacity 1.5s ease-in-out;
                    z-index: 0;
                }

                .login-left-overlay {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(17, 24, 39, 0.2) 100%);
                    z-index: 1;
                }

                .login-left-content {
                    position: relative;
                    z-index: 2;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justifyContent: flex-start;
                    padding-top: 20px;
                }

                .login-branding {
                    margin-bottom: 20px;
                }

                .login-brand-logo {
                    width: 240px;
                    height: auto;
                    margin-bottom: 20px;
                    filter: drop-shadow(0px 4px 8px rgba(0,0,0,0.6));
                }

                .login-brand-tagline {
                    font-size: 18px;
                    color: #f3f4f6;
                    font-weight: 300;
                    margin: 0;
                    letter-spacing: 0.04em;
                    white-space: nowrap;
                    text-transform: uppercase;
                }

                .login-quote-box {
                    margin-bottom: 20px;
                    border-left: 2px solid #14b8a6;
                    padding-left: 20px;
                }

                .login-quote-text {
                    font-size: 15px;
                    color: #d1d5db;
                    font-style: italic;
                    font-weight: 300;
                    margin: 0;
                    max-width: 800px;
                    line-height: 1.6;
                }

                .login-quote-author {
                    font-size: 13px;
                    margin-top: 8px;
                    font-weight: 500;
                    font-style: normal;
                    color: #14b8a6;
                    margin-bottom: 0;
                }

                .login-right-pane {
                    flex: 3;
                    display: flex;
                    justifyContent: center;
                    align-items: center;
                    background-color: #ffffff;
                    padding: 40px;
                    position: relative;
                    z-index: 5;
                    box-shadow: -30px 0 40px 10px #ffffff;
                    height: 100%;
                    overflow-y: auto;
                }

                .login-mobile-header {
                    display: none;
                    text-align: center;
                    margin-bottom: 12px;
                }

                .login-mobile-logo {
                    width: 170px;
                    height: auto;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
                }

                .login-form-wrapper {
                    width: 100%;
                    max-width: 400px;
                    display: flex;
                    flex-direction: column;
                }

                .login-header-block {
                    margin-bottom: 28px;
                }

                .login-title {
                    font-size: 28px;
                    font-weight: 800;
                    color: #111827;
                    margin: 0 0 6px 0;
                    letter-spacing: -0.02em;
                }

                .login-subtitle {
                    font-size: 14px;
                    color: #6b7280;
                    margin: 0;
                }

                .login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }

                .login-input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .login-label {
                    font-size: 12.5px;
                    font-weight: 600;
                    color: #374151;
                }

                .login-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .login-input-icon {
                    position: absolute;
                    left: 14px;
                    pointer-events: none;
                }

                .login-password-toggle {
                    position: absolute;
                    right: 14px;
                    background: none;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .login-input-field {
                    width: 100%;
                    background-color: #f9fafb;
                    border: 1px solid #d1d5db;
                    border-radius: 10px;
                    padding: 12px 40px 12px 42px;
                    font-size: 13.5px;
                    color: #111827;
                    outline: none;
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
                    box-sizing: border-box;
                }

                .login-input-field:focus {
                    background-color: #ffffff;
                    border-color: #0f172a !important;
                    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08) !important;
                }

                .login-submit-btn {
                    background-color: #0f172a;
                    color: #ffffff;
                    border: none;
                    border-radius: 10px;
                    padding: 13px 20px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
                    margin-top: 4px;
                }

                .login-submit-btn:hover {
                    background-color: #1e293b;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.24);
                }

                .login-submit-btn:active {
                    transform: translateY(0);
                }

                .login-error-box {
                    background-color: #fef2f2;
                    color: #ef4444;
                    padding: 11px 14px;
                    border-radius: 8px;
                    font-size: 12.5px;
                    text-align: center;
                    margin-bottom: 16px;
                    border: 1px solid #fecaca;
                    font-weight: 500;
                }

                .login-warning-box {
                    background-color: #fffbeb;
                    color: #d97706;
                    padding: 12px 14px;
                    border-radius: 8px;
                    font-size: 12.5px;
                    text-align: center;
                    margin-bottom: 12px;
                    border: 1px solid #fde68a;
                    line-height: 1.4;
                    font-weight: 500;
                }

                .login-footer {
                    margin-top: 24px;
                    font-size: 11.5px;
                    color: #9ca3af;
                    text-align: center;
                }

                /* =========================================================================
                   MOBILE / SMALL SCREEN OPTIMIZATIONS (SLIDESHOW BACKGROUND + GLASS CARD)
                   ========================================================================= */
                @media (max-width: 900px) {
                    .login-root-container {
                        height: 100vh !important;
                        min-height: 100vh !important;
                        max-height: 100vh !important;
                        width: 100vw !important;
                        max-width: 100vw !important;
                        flex-direction: column !important;
                        justify-content: center !important;
                        align-items: center !important;
                        padding: 16px !important;
                        box-sizing: border-box !important;
                        position: relative !important;
                    }

                    /* Make left pane full-screen background for mobile */
                    .login-left-pane {
                        display: block !important;
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        padding: 0 !important;
                        z-index: 1 !important;
                        -webkit-mask-image: none !important;
                        mask-image: none !important;
                    }

                    .login-left-overlay {
                        background: radial-gradient(circle at center, rgba(15, 23, 42, 0.45) 0%, rgba(15, 23, 42, 0.8) 100%) !important;
                        backdrop-filter: blur(3px) !important;
                        -webkit-backdrop-filter: blur(3px) !important;
                    }

                    /* Hide the desktop quote content on mobile to keep form clean */
                    .login-left-content {
                        display: none !important;
                    }

                    /* Glassmorphism Floating Card */
                    .login-right-pane {
                        flex: none !important;
                        width: 100% !important;
                        max-width: 380px !important;
                        background: rgba(255, 255, 255, 0.94) !important;
                        backdrop-filter: blur(16px) !important;
                        -webkit-backdrop-filter: blur(16px) !important;
                        border: 1px solid rgba(255, 255, 255, 0.6) !important;
                        border-radius: 20px !important;
                        padding: 24px 20px !important;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
                        height: auto !important;
                        max-height: calc(100vh - 32px) !important;
                        overflow-y: hidden !important;
                        margin: auto !important;
                        position: relative !important;
                        z-index: 10 !important;
                    }

                    .login-mobile-header {
                        display: block !important;
                        margin-bottom: 6px !important;
                    }

                    .login-mobile-logo {
                        width: 155px !important;
                        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.08)) !important;
                    }

                    .login-header-block {
                        margin-bottom: 14px !important;
                        text-align: center !important;
                    }

                    .login-title {
                        font-size: 22px !important;
                        margin-bottom: 2px !important;
                        color: #0f172a !important;
                    }

                    .login-subtitle {
                        font-size: 12px !important;
                        color: #64748b !important;
                    }

                    .login-form {
                        gap: 11px !important;
                    }

                    .login-input-group {
                        gap: 4px !important;
                    }

                    .login-label {
                        font-size: 11.5px !important;
                        color: #334155 !important;
                    }

                    .login-input-field {
                        padding: 10px 38px 10px 38px !important;
                        font-size: 13px !important;
                        border-radius: 8px !important;
                        background-color: rgba(248, 250, 252, 0.9) !important;
                        border: 1px solid #cbd5e1 !important;
                    }

                    .login-input-field:focus {
                        background-color: #ffffff !important;
                        border-color: #0f172a !important;
                    }

                    .login-submit-btn {
                        padding: 11px 16px !important;
                        font-size: 13.5px !important;
                        margin-top: 4px !important;
                        border-radius: 8px !important;
                        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
                    }

                    .login-footer {
                        margin-top: 12px !important;
                        font-size: 10px !important;
                        color: #64748b !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default Login;
