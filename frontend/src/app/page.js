'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { jwtDecode } from 'jwt-decode';
import LockerScene from '../components/LockerScene';
import { db } from '../../db';

const API_BASE_URL = 'http://localhost:8080';

// --- Helper UI Components (Defined Outside Home) ---

// Component for Patient's File View
const PatientFileView = ({ files, handleViewOrDownload, isLoading }) => (
    <div className="styled-header-box">
        <h2 style={{ marginBottom: '1rem', color: 'white' }}>Your Documents</h2>
        {Array.isArray(files) && files.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {files.map(file => (
                    <li key={file.docId} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '0.75rem', 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.2)' 
                    }}>
                        <span style={{ color: 'white' }}>{file.originalFilename}</span>
                        <button 
                            onClick={() => handleViewOrDownload(file.docId, file.originalFilename)} 
                            style={{ 
                                padding: '0.5rem 1rem', 
                                backgroundColor: '#007bff', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '4px', 
                                cursor: 'pointer' 
                            }}
                            disabled={isLoading}
                        >
                            View / Download
                        </button>
                    </li>
                ))}
            </ul>
        ) : <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>No documents found for you.</p>}
    </div>
);

// Component for Doctor's File View
const DoctorFileView = ({ 
    files, 
    conversations, 
    openShareModal, 
    handleViewOrDownload, 
    openHistoryModal, 
    setIsNewMessageModalOpen,
    isLoading 
}) => (
    <>
        {/* SECTION 1: Assigned Patient Documents */}
        <div className="styled-header-box">
            <h2>Assigned Patient Documents</h2>
            {files.assigned && Object.keys(files.assigned).length > 0 ? (
                Object.keys(files.assigned).map(patientUid => (
                    <div key={patientUid} style={{marginBottom: '1.5rem'}}>
                        <h3 style={{borderBottom: '1px solid #ccc', paddingBottom: '0.5rem'}}>Patient: <code>{patientUid}</code></h3>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {files.assigned[patientUid].map(file => (
                                <li key={file.docId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                                    <span>{file.originalFilename}</span>
                                    <div>
                                        <button 
                                            onClick={() => openShareModal(file.docId, file.originalFilename)} 
                                            style={{ 
                                                padding: '0.25rem 0.5rem', 
                                                marginRight: '0.5rem', 
                                                background: '#e0e0e0', 
                                                border: '1px solid #ccc', 
                                                cursor: 'pointer' 
                                            }}
                                            disabled={isLoading}
                                        >
                                            Share
                                        </button>
                                        <button 
                                            onClick={() => handleViewOrDownload(file.docId, file.originalFilename)} 
                                            style={{ padding: '0.25rem 0.5rem' }}
                                            disabled={isLoading}
                                        >
                                            View / Download
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))
            ) : <p>No documents found for your assigned patients.</p>}
        </div>

        {/* SECTION 2: Documents Shared With You */}
        <div className="styled-header-box">
            <h2>Documents Shared With You</h2>
            {files.shared && files.shared.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {files.shared.map(file => (
                        <li key={file.docId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                            <div>
                                <span style={{ display: 'block', fontWeight: 'bold' }}>{file.originalFilename}</span>
                                <span style={{ fontSize: '0.85em', color: '#666' }}>
                                    From patient: <code>{file.ownerUid}</code>
                                </span>
                            </div>
                            <button 
                                onClick={() => handleViewOrDownload(file.docId, file.originalFilename)} 
                                style={{ padding: '0.25rem 0.5rem' }}
                                disabled={isLoading}
                            >
                                View / Download
                            </button>
                        </li>
                    ))}
                </ul>
            ) : <p>No documents have been shared with you directly.</p>}
        </div>

        {/* SECTION 3: Message Inbox (UPDATED) */}
        <div className="styled-header-box">
            <h2>Message Inbox</h2>
            <button 
                onClick={() => setIsNewMessageModalOpen(true)} 
                style={{ 
                    marginBottom: '1rem', 
                    padding: '0.5rem 1rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                + New Message
            </button>
            {conversations.length > 0 ? (
                conversations.map(convo => (
                    <div key={convo.conversationId} style={{borderBottom: '1px solid #ccc', paddingBottom: '1rem', marginBottom: '1rem'}}>
                        <p><strong>Conversation With:</strong> <code>{convo.participants && convo.participants.find(p => p !== auth.currentUser?.uid) || 'Yourself'}</code></p>
                        <p><strong>Last Message:</strong> "{convo.lastMessage || 'No message content'}"</p>
                        <button 
                            onClick={() => openHistoryModal(convo.conversationId)}
                            style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            View History
                        </button>
                    </div>
                ))
            ) : <p>You have no messages.</p>}
        </div>
    </>
);

// Component for Admin's Dashboard View
const AdminDashboard = ({ 
    adminDashboardData, 
    handleVisibilityToggle, 
    handleViewOrDownload,
    newUserEmail, setNewUserEmail,
    newUserPassword, setNewUserPassword,
    handleCreateUser,
    assignDoctorUid, setAssignDoctorUid,
    assignPatientUid, setAssignPatientUid,
    handleAssignPatient,
    isLoading 
}) => (
    <>
        {/* Section 1: Create New Users */}
        <div className="styled-header-box">
            <h2 style={{ color: 'white', marginBottom: '1rem' }}>Create New User</h2>
            <input 
                type="email" 
                value={newUserEmail} 
                onChange={(e) => setNewUserEmail(e.target.value)} 
                placeholder="New User's Email" 
                style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    padding: '0.5rem', 
                    width: '300px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '4px',
                    color: 'white'
                }}
            />
            <input 
                type="password" 
                value={newUserPassword} 
                onChange={(e) => setNewUserPassword(e.target.value)} 
                placeholder="New User's Password" 
                style={{ 
                    display: 'block', 
                    marginBottom: '1rem', 
                    padding: '0.5rem', 
                    width: '300px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '4px',
                    color: 'white'
                }}
            />
            <button 
                onClick={() => handleCreateUser('doctor')} 
                disabled={isLoading}
                style={{ 
                    padding: '0.5rem 1rem', 
                    marginRight: '1rem',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    opacity: isLoading ? 0.6 : 1
                }}
            >
                Create Doctor
            </button>
            <button 
                onClick={() => handleCreateUser('patient')} 
                disabled={isLoading}
                style={{ 
                    padding: '0.5rem 1rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    opacity: isLoading ? 0.6 : 1
                }}
            >
                Create Patient
            </button>
        </div>

        {/* Section 2: Assign Patient to Doctor */}
        <div className="styled-header-box">
            <h2 style={{ color: 'white', marginBottom: '1rem' }}>Assign Patient to Doctor</h2>
            <input 
                type="text" 
                value={assignDoctorUid} 
                onChange={(e) => setAssignDoctorUid(e.target.value)} 
                placeholder="Doctor's User ID (UID)" 
                style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    padding: '0.5rem', 
                    width: '300px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '4px',
                    color: 'white'
                }}
            />
            <input 
                type="text" 
                value={assignPatientUid} 
                onChange={(e) => setAssignPatientUid(e.target.value)} 
                placeholder="Patient's User ID (UID)" 
                style={{ 
                    display: 'block', 
                    marginBottom: '1rem', 
                    padding: '0.5rem', 
                    width: '300px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '4px',
                    color: 'white'
                }}
            />
            <button 
                onClick={handleAssignPatient} 
                disabled={isLoading}
                style={{ 
                    padding: '0.5rem 1rem',
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    opacity: isLoading ? 0.6 : 1
                }}
            >
                Assign Patient
            </button>
        </div>

        {/* Section 3: Existing Assignments & Documents Dashboard */}
        <div className="styled-header-box">
            <h2 style={{ color: 'white', marginBottom: '1rem' }}>Assignments & Documents</h2>
            {adminDashboardData.length > 0 ? (
                adminDashboardData.map(assignment => (
                    <div key={assignment.doctorId} style={{marginBottom: '2rem'}}>
                        <h3 style={{marginTop: 0, color: 'rgba(255, 255, 255, 0.9)'}}>
                            Doctor: <code style={{fontSize: '0.9em', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px', color: 'rgba(255, 255, 255, 0.9)'}}>{assignment.doctorId}</code>
                        </h3>
                        {assignment.patients.length > 0 ? (
                            assignment.patients.map(patient => (
                                <div key={patient.uid} style={{
                                    paddingLeft: '20px', 
                                    borderLeft: '2px solid rgba(255, 255, 255, 0.2)', 
                                    marginBottom: '1.5rem'
                                }}>
                                    <h4 style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1rem' }}>
                                        Patient: <code style={{fontSize: '0.9em', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px', color: 'rgba(255, 255, 255, 0.9)'}}>{patient.uid}</code>
                                    </h4>
                                    {patient.files.length > 0 ? (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{width: '100%', fontSize: '0.9em', borderCollapse: 'collapse'}}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.2)' }}>
                                                        <th style={{ padding: '12px', textAlign: 'left', color: 'white' }}>Document Name</th>
                                                        <th style={{ padding: '12px', textAlign: 'right', color: 'white' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {patient.files.map(file => (
                                                        <tr key={file.docId} style={{borderBottom: '1px solid rgba(255, 255, 255, 0.1)'}}>
                                                            <td style={{padding: '12px', color: 'white'}}>{file.originalFilename}</td>
                                                            <td style={{padding: '12px', textAlign: 'right'}}>
                                                                <label style={{
                                                                    marginRight: '1rem', 
                                                                    cursor: 'pointer', 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center',
                                                                    fontSize: '0.85em',
                                                                    color: 'rgba(255, 255, 255, 0.9)'
                                                                }}>
                                                                    Visible to Patient:
                                                                    <input 
                                                                        type="checkbox"
                                                                        checked={file.isVisibleToPatient || false}
                                                                        onChange={() => handleVisibilityToggle(file.docId, file.isVisibleToPatient || false)}
                                                                        style={{
                                                                            marginLeft: '0.5rem', 
                                                                            height: '16px', 
                                                                            width: '16px',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    />
                                                                </label>
                                                                <button 
                                                                    onClick={() => handleViewOrDownload(file.docId, file.originalFilename)} 
                                                                    style={{ 
                                                                        padding: '0.5rem 1rem', 
                                                                        backgroundColor: '#007bff', 
                                                                        color: 'white', 
                                                                        border: 'none', 
                                                                        borderRadius: '4px', 
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    disabled={isLoading}
                                                                >
                                                                    View / Download
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : <p style={{fontSize: '0.9em', color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic'}}>No documents found for this patient.</p>}
                                </div>
                            ))
                        ) : <p style={{fontSize: '0.9em', color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic'}}>No patients assigned to this doctor.</p>}
                    </div>
                ))
            ) : <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Loading assignment data or no assignments found...</p>}
        </div>
    </>
);

// NEW: MainView is now defined OUTSIDE Home and accepts props
const MainView = ({ 
    userRole, 
    files, 
    conversations, 
    adminDashboardData, 
    handleVisibilityToggle, 
    handleViewOrDownload,
    newUserEmail, setNewUserEmail,
    newUserPassword, setNewUserPassword,
    handleCreateUser,
    assignDoctorUid, setAssignDoctorUid,
    assignPatientUid, setAssignPatientUid,
    handleAssignPatient,
    openShareModal,
    openHistoryModal,
    setIsNewMessageModalOpen,
    isLoading 
}) => {
    if (userRole === 'admin') {
        return <AdminDashboard 
            adminDashboardData={adminDashboardData} 
            handleVisibilityToggle={handleVisibilityToggle} 
            handleViewOrDownload={handleViewOrDownload}
            newUserEmail={newUserEmail} 
            setNewUserEmail={setNewUserEmail}
            newUserPassword={newUserPassword} 
            setNewUserPassword={setNewUserPassword}
            handleCreateUser={handleCreateUser}
            assignDoctorUid={assignDoctorUid} 
            setAssignDoctorUid={setAssignDoctorUid}
            assignPatientUid={assignPatientUid} 
            setAssignPatientUid={setAssignPatientUid}
            handleAssignPatient={handleAssignPatient}
            isLoading={isLoading}
        />;
    }
    if (userRole === 'doctor') {
        return <DoctorFileView 
            files={files} 
            conversations={conversations} 
            openShareModal={openShareModal} 
            handleViewOrDownload={handleViewOrDownload} 
            openHistoryModal={openHistoryModal}
            setIsNewMessageModalOpen={setIsNewMessageModalOpen}
            isLoading={isLoading}
        />;
    }
    // Default view for Patient
    return <PatientFileView 
        files={files} 
        handleViewOrDownload={handleViewOrDownload}
        isLoading={isLoading}
    />;
};

// --- Main Home Component ---
export default function Home() {
    // --- State Variables ---
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [idToken, setIdToken] = useState('');
    const [userRole, setUserRole] = useState(null);
    const [planeAnimation, setPlaneAnimation] = useState('idle');
    const [isLoading, setIsLoading] = useState(false);

    // State for File Upload
    const [selectedFile, setSelectedFile] = useState(null);
    const [patientEmail, setPatientEmail] = useState('');

    // State for Data Display
    const [files, setFiles] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [adminDashboardData, setAdminDashboardData] = useState([]);

    // State for Modals/Forms
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareDocInfo, setShareDocInfo] = useState(null);
    const [shareRecipientEmail, setShareRecipientEmail] = useState('');
    const [shareTextMessage, setShareTextMessage] = useState('');

    // NEW State for Admin Forms
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [assignDoctorUid, setAssignDoctorUid] = useState('');
    const [assignPatientUid, setAssignPatientUid] = useState('');

    // NEW State for messaging
    const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
    const [newMessageRecipientEmail, setNewMessageRecipientEmail] = useState('');
    const [newMessageText, setNewMessageText] = useState('');
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedConversationId, setSelectedConversationId] = useState(null);
    const [messageHistory, setMessageHistory] = useState([]);

    // --- UseEffect Hooks ---
    useEffect(() => {
        if (userRole === 'admin' && Array.isArray(files) && files.length > 0 && assignments.length > 0) {
            const filesByOwner = files.reduce((acc, file) => {
                const owner = file.ownerUid;
                if (!acc[owner]) { acc[owner] = []; }
                acc[owner].push(file);
                return acc;
            }, {});
            const dashboardData = assignments.map(assignment => ({
                ...assignment,
                patients: (assignment.patientUids || []).map(patientUid => ({
                    uid: patientUid,
                    files: filesByOwner[patientUid] || []
                }))
            }));
            setAdminDashboardData(dashboardData);
        }
    }, [files, assignments, userRole]);

    useEffect(() => {
        if (planeAnimation === 'takingOff') {
            const timer = setTimeout(() => {
                setPlaneAnimation('landing');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [planeAnimation]);

    // --- API Fetching Functions ---
    const fetchAssignments = async (token) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/admin/assignments`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const assignmentsData = response.data.map(doc => ({
                doctorId: doc.id,
                patientUids: doc.data.patientUids || []
            }));
            setAssignments(assignmentsData);
        } catch (error) {
            console.error("Failed to fetch assignments:", error);
            setMessage('Failed to load assignments.');
        }
    };

    const fetchFiles = async (token, role) => {
        try {
            setMessage('Fetching files...');
            const response = await axios.get(`${API_BASE_URL}/api/files/list`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (role === 'doctor') {
                const filesFromApi = response.data;
                const groupedFiles = {
                    assigned: {},
                    shared: []
                };

                filesFromApi.forEach(file => {
                    if (file.accessType === 'assigned') {
                        const patientUid = file.ownerUid;
                        if (!groupedFiles.assigned[patientUid]) {
                            groupedFiles.assigned[patientUid] = [];
                        }
                        groupedFiles.assigned[patientUid].push(file);
                    } else if (file.accessType === 'shared') {
                        groupedFiles.shared.push(file);
                    }
                });

                setFiles(groupedFiles);
            } else {
                setFiles(response.data);
            }
            
            setMessage('Files loaded successfully.');
        } catch (error) {
            console.error("Failed to fetch files:", error);
            setMessage('Failed to fetch files.');
        }
    };

    const fetchConversations = async (token) => {
        try {
            setMessage('Fetching conversations...');
            const response = await axios.get(`${API_BASE_URL}/api/messages/conversations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setConversations(response.data);
            setMessage('Conversations loaded successfully.');
        } catch (error) {
            console.error("Failed to fetch conversations:", error);
            setMessage('Failed to load conversations.');
        }
    };

    // NEW: Fetch message history for a specific conversation
    const fetchMessageHistory = async (conversationId) => {
        if (!conversationId || !idToken) return;
        try {
            setMessage('Loading messages...');
            const response = await axios.get(`${API_BASE_URL}/api/messages/conversations/${conversationId}/messages`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            setMessageHistory(response.data);
            setIsHistoryModalOpen(true);
        } catch (error) {
            console.error("Failed to fetch message history:", error);
            setMessage('Failed to load messages.');
        }
    };

    // --- Event Handlers ---
    const handleLogin = async () => {
        if (!email || !password) {
            setMessage('Please enter both email and password.');
            return;
        }

        setIsLoading(true);
        try {
            setMessage('Signing in...');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const token = await userCredential.user.getIdToken();
            setIdToken(token);
            
            const decodedToken = jwtDecode(token);
            const role = decodedToken.role;
            setUserRole(role);
            
            setMessage('Sign in successful!');
            setPlaneAnimation('landing');
            await fetchFiles(token, role);

            if (role === 'admin') {
                await fetchAssignments(token);
            }
            if (role === 'doctor') {
                await fetchConversations(token);
            }
        } catch (error) {
            console.error("Login failed:", error);
            setMessage(`Login failed: ${error.message}`);
            setIdToken('');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setMessage('Please select a file first.');
            return;
        }
        
        if ((userRole === 'admin' || userRole === 'doctor') && !patientEmail) {
            setMessage('Please enter the Patient Email to assign the document to.');
            return;
        }

        setIsLoading(true);
        try {
            setMessage('Uploading file...');
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('patientEmail', patientEmail);

            await axios.post(`${API_BASE_URL}/api/files/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${idToken}`
                },
            });
            
            setMessage('File uploaded successfully! Refreshing file list...');
            setPlaneAnimation('takingOff');
            await fetchFiles(idToken, userRole);
            
            setSelectedFile(null);
            setPatientEmail('');
        } catch (error) {
            console.error("Upload failed:", error);
            setMessage(`Upload failed: ${error.response?.data?.error || error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewOrDownload = async (docId, filename) => {
        try {
            const localFile = await db.files.get(docId);

            if (localFile) {
                setMessage(`Loading ${filename} from local cache...`);
                const url = URL.createObjectURL(localFile.blob);
                window.open(url, '_blank');
                setMessage(`${filename} loaded from cache.`);
            } else {
                setMessage(`Downloading ${filename}...`);
                const response = await axios.get(`${API_BASE_URL}/api/files/${docId}/download`, {
                    headers: { 'Authorization': `Bearer ${idToken}` },
                    responseType: 'blob'
                });

                const fileBlob = response.data;
                await db.files.add({ docId: docId, blob: fileBlob });
                setMessage(`Saved ${filename} to local cache.`);

                const url = URL.createObjectURL(fileBlob);
                window.open(url, '_blank');
            }
        } catch (error) {
            console.error("Download failed:", error);
            setMessage(`Failed to view or download ${filename}.`);
        }
    };
    
    const openShareModal = (docId, filename) => {
        setShareDocInfo({ docId, filename });
        setIsShareModalOpen(true);
    };
    
    const handleShare = async () => {
        if (!shareRecipientEmail || !shareDocInfo) return;
        
        setIsLoading(true);
        try {
            setMessage('Sharing document...');
            await axios.post(`${API_BASE_URL}/api/messages/share`, 
                {
                    recipientEmail: shareRecipientEmail,
                    textMessage: shareTextMessage,
                    docId: shareDocInfo.docId,
                    originalFilename: shareDocInfo.filename
                },
                { headers: { 'Authorization': `Bearer ${idToken}` } }
            );
            setMessage(`Document successfully shared with ${shareRecipientEmail}.`);
            setPlaneAnimation('takingOff');
            setIsShareModalOpen(false);
            setShareRecipientEmail('');
            setShareTextMessage('');
            
            if (userRole === 'doctor') {
                await fetchConversations(idToken);
            }
        } catch (error) {
            console.error("Failed to share document:", error);
            setMessage('Failed to share document.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVisibilityToggle = async (docId, currentVisibility) => {
        const newVisibility = !currentVisibility;
        try {
            setMessage(`Updating visibility for document...`);
            await axios.post(`${API_BASE_URL}/api/admin/documents/${docId}/toggle-visibility`,
                { isVisible: newVisibility },
                { headers: { 'Authorization': `Bearer ${idToken}` } }
            );
            
            const updatedData = adminDashboardData.map(assign => ({
                ...assign,
                patients: assign.patients.map(p => ({
                    ...p,
                    files: p.files.map(f =>
                        f.docId === docId ? { ...f, isVisibleToPatient: newVisibility } : f
                    )
                }))
            }));
            setAdminDashboardData(updatedData);
            setMessage('Visibility updated successfully.');
        } catch (error) {
            console.error("Failed to toggle visibility:", error);
            setMessage('Failed to update visibility.');
        }
    };

    // NEW: Send a general message
    const handleSendMessage = async () => {
        if (!newMessageRecipientEmail || !newMessageText) return;
        
        setIsLoading(true);
        try {
            setMessage('Sending message...');
            await axios.post(`${API_BASE_URL}/api/messages/send`,
                { 
                    recipientEmail: newMessageRecipientEmail, 
                    textMessage: newMessageText 
                },
                { headers: { 'Authorization': `Bearer ${idToken}` } }
            );
            setMessage('Message sent successfully.');
            setIsNewMessageModalOpen(false);
            setNewMessageRecipientEmail('');
            setNewMessageText('');
            await fetchConversations(idToken);
        } catch (error) {
            console.error("Failed to send message:", error);
            setMessage('Failed to send message.');
        } finally {
            setIsLoading(false);
        }
    };

    // NEW: Open history modal when clicking on a conversation
    const openHistoryModal = (conversationId) => {
        setSelectedConversationId(conversationId);
        fetchMessageHistory(conversationId);
    };

    // --- NEW Admin Action Handlers ---
    const handleCreateUser = async (roleToCreate) => {
        if (!newUserEmail || !newUserPassword) {
            setMessage(`Please enter email and password for the new ${roleToCreate}.`);
            return;
        }
        setIsLoading(true);
        try {
            setMessage(`Creating new ${roleToCreate}...`);
            const response = await axios.post(`${API_BASE_URL}/api/admin/create-user`,
                { email: newUserEmail, password: newUserPassword, role: roleToCreate },
                { headers: { 'Authorization': `Bearer ${idToken}` } }
            );
            setMessage(response.data.message + ` (UID: ${response.data.uid})`);
            setNewUserEmail('');
            setNewUserPassword('');
        } catch (error) {
            console.error(`Failed to create ${roleToCreate}:`, error);
            setMessage(`Failed to create ${roleToCreate}: ${error.response?.data?.error || error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAssignPatient = async () => {
        if (!assignDoctorUid || !assignPatientUid) {
            setMessage('Please enter both Doctor UID and Patient UID to assign.');
            return;
        }
        setIsLoading(true);
        try {
            setMessage(`Assigning patient ${assignPatientUid} to doctor ${assignDoctorUid}...`);
            const response = await axios.post(`${API_BASE_URL}/api/admin/assign-patient`,
                { doctorUid: assignDoctorUid, patientUid: assignPatientUid },
                { headers: { 'Authorization': `Bearer ${idToken}` } }
            );
            setMessage(response.data);
            setAssignDoctorUid('');
            setAssignPatientUid('');
            await fetchAssignments(idToken);
        } catch (error) {
            console.error("Failed to assign patient:", error);
            setMessage(`Failed to assign patient: ${error.response?.data?.error || error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        setIdToken('');
        setUserRole(null);
        setFiles([]);
        setAssignments([]);
        setAdminDashboardData([]);
        setConversations([]);
        setEmail('');
        setPassword('');
        setMessage('Logged out successfully.');
        setPlaneAnimation('idle');
    };

    // --- Final Render ---
    return (
        <>
            <LockerScene planeAnimation={planeAnimation} setPlaneAnimation={setPlaneAnimation} />

            <main style={{
                position: 'relative',
                zIndex: 1,
                fontFamily: 'sans-serif',
                maxWidth: '700px',
                margin: '5vh auto',
                padding: '2rem',
                background: 'rgba(0, 0, 0, 0)',
                borderRadius: '10px',
            }}>
                <div className="styled-header-box">
                    <div className="logo-header-container">
    <img src="/logo.svg" alt="Digital Locker Logo" className="logo-image" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h1 style={{ color: 'white', margin: 0 }}>Hospital Digital Locker</h1>
                        {idToken && (
                            <button 
                                onClick={handleLogout}
                                style={{ 
                                    padding: '0.5rem 1rem', 
                                    backgroundColor: '#dc3545', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '4px', 
                                    cursor: 'pointer' 
                                }}
                            >
                                Logout
                            </button>
                        )}
                    </div>
                </div>
                </div>
                
                {!idToken ? (
                    <div className="styled-header-box">
                        <h2 style={{ color: 'white' }}>Sign In</h2>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            placeholder="Email" 
                            style={{ 
                                display: 'block', 
                                marginBottom: '0.5rem', 
                                padding: '0.5rem', 
                                width: '300px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: '4px',
                                color: 'white'
                            }} 
                        />
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder="Password" 
                            style={{ 
                                display: 'block', 
                                marginBottom: '0.5rem', 
                                padding: '0.5rem', 
                                width: '300px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: '4px',
                                color: 'white'
                            }} 
                        />
                        <button 
                            onClick={handleLogin} 
                            disabled={isLoading}
                            style={{ 
                                padding: '0.5rem 1rem',
                                opacity: isLoading ? 0.6 : 1,
                                background: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ 
                            marginBottom: '1rem', 
                            padding: '0.75rem', 
                            backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                            borderRadius: '4px',
                            color: 'white'
                        }}>
                            <strong>Role:</strong> {userRole} | <strong>Email:</strong> {email}
                        </div>

                        {(userRole === 'admin' || userRole === 'doctor') && (
                            <div className="styled-header-box">
                                <h2 style={{ color: 'white', marginBottom: '1rem' }}>Upload Document for Patient</h2>
                                <input 
                                    type="email" 
                                    value={patientEmail} 
                                    onChange={(e) => setPatientEmail(e.target.value)} 
                                    placeholder="Enter Patient's Email Address" 
                                    style={{ 
                                        display: 'block', 
                                        marginBottom: '0.5rem', 
                                        padding: '0.5rem', 
                                        width: '300px',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(255, 255, 255, 0.3)',
                                        borderRadius: '4px',
                                        color: 'white'
                                    }}
                                />
                                <input 
                                    type="file" 
                                    onChange={(e) => setSelectedFile(e.target.files[0])} 
                                    style={{ 
                                        display: 'block', 
                                        marginBottom: '0.5rem',
                                        color: 'white'
                                    }} 
                                />
                                <button 
                                    onClick={handleUpload} 
                                    disabled={isLoading}
                                    style={{ 
                                        padding: '0.5rem 1rem',
                                        opacity: isLoading ? 0.6 : 1,
                                        background: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {isLoading ? 'Uploading...' : 'Upload File'}
                                </button>
                            </div>
                        )}
                        
                        {/* UPDATED: Pass props to MainView */}
                        <MainView 
                            userRole={userRole}
                            files={files}
                            conversations={conversations}
                            adminDashboardData={adminDashboardData}
                            // Pass all handlers and state setters needed by child components
                            handleVisibilityToggle={handleVisibilityToggle} 
                            handleViewOrDownload={handleViewOrDownload}
                            newUserEmail={newUserEmail} 
                            setNewUserEmail={setNewUserEmail}
                            newUserPassword={newUserPassword} 
                            setNewUserPassword={setNewUserPassword}
                            handleCreateUser={handleCreateUser}
                            assignDoctorUid={assignDoctorUid} 
                            setAssignDoctorUid={setAssignDoctorUid}
                            assignPatientUid={assignPatientUid} 
                            setAssignPatientUid={setAssignPatientUid}
                            handleAssignPatient={handleAssignPatient}
                            openShareModal={openShareModal}
                            openHistoryModal={openHistoryModal}
                            setIsNewMessageModalOpen={setIsNewMessageModalOpen}
                            isLoading={isLoading}
                        />
                    </>
                )}

                {message && (
                    <p style={{ 
                        marginTop: '1rem', 
                        padding: '1rem',
                        borderRadius: '4px',
                        backgroundColor: message.includes('failed') ? 'rgba(220, 53, 69, 0.2)' : 'rgba(21, 87, 36, 0.2)',
                        color: message.includes('failed') ? '#f8d7da' : '#d1edff',
                        border: `1px solid ${message.includes('failed') ? 'rgba(220, 53, 69, 0.3)' : 'rgba(21, 87, 36, 0.3)'}`,
                    }}>
                        {message}
                    </p>
                )}
                
                {idToken && (
                    <div className="styled-header-box">
                        <b style={{display: 'block', marginBottom: '0.5rem', color: 'white'}}>Your ID Token (JWT):</b>
                        <textarea
                            readOnly
                            value={idToken}
                            style={{ 
                                width: '100%', 
                                height: '150px', 
                                fontFamily: 'monospace', 
                                fontSize: '1rem',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: '4px',
                                color: 'white',
                                padding: '0.5rem'
                            }}
                            onClick={(e) => e.target.select()}
                        />
                    </div>
                )}
            </main>

            {/* Share Modal */}
            {isShareModalOpen && (
                <div style={{
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    background: 'rgba(0,0,0,0.5)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.95)', 
                        padding: '2rem', 
                        borderRadius: '8px', 
                        width: '400px', 
                        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <h3 style={{ marginBottom: '1rem' }}>Share Document: {shareDocInfo?.filename}</h3>
                        <input 
                            type="email" 
                            placeholder="Recipient Doctor's Email" 
                            value={shareRecipientEmail} 
                            onChange={(e) => setShareRecipientEmail(e.target.value)} 
                            style={{
                                width: '100%', 
                                padding: '0.75rem', 
                                boxSizing: 'border-box', 
                                marginBottom: '1rem',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }} 
                        />
                        <textarea 
                            placeholder="Add a message (optional)..." 
                            value={shareTextMessage} 
                            onChange={(e) => setShareTextMessage(e.target.value)} 
                            style={{
                                width: '100%', 
                                padding: '0.75rem', 
                                boxSizing: 'border-box', 
                                height: '80px', 
                                marginBottom: '1rem',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                resize: 'vertical'
                            }} 
                        />
                        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                            <button 
                                onClick={() => setIsShareModalOpen(false)} 
                                style={{
                                    marginRight: '1rem', 
                                    padding: '0.5rem 1rem', 
                                    backgroundColor: '#6c757d', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '4px', 
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleShare}
                                disabled={isLoading || !shareRecipientEmail}
                                style={{
                                    padding: '0.5rem 1rem', 
                                    backgroundColor: '#28a745', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '4px', 
                                    cursor: 'pointer',
                                    opacity: (isLoading || !shareRecipientEmail) ? 0.6 : 1
                                }}
                            >
                                {isLoading ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW: New Message Modal */}
            {isNewMessageModalOpen && (
                <div style={{
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    background: 'rgba(0,0,0,0.5)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.95)', 
                        padding: '2rem', 
                        borderRadius: '8px', 
                        width: '400px', 
                        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <h3 style={{ marginBottom: '1rem' }}>Send New Message</h3>
                        <input 
                            type="email" 
                            placeholder="Recipient Doctor's Email" 
                            value={newMessageRecipientEmail} 
                            onChange={(e) => setNewMessageRecipientEmail(e.target.value)} 
                            style={{
                                width: '100%', 
                                padding: '0.75rem', 
                                boxSizing: 'border-box', 
                                marginBottom: '1rem',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                            }} 
                        />
                        <textarea 
                            placeholder="Your message..." 
                            value={newMessageText} 
                            onChange={(e) => setNewMessageText(e.target.value)} 
                            style={{
                                width: '100%', 
                                padding: '0.75rem', 
                                boxSizing: 'border-box', 
                                height: '120px', 
                                marginBottom: '1rem',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                resize: 'vertical'
                            }} 
                        />
                        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                            <button 
                                onClick={() => setIsNewMessageModalOpen(false)} 
                                style={{
                                    marginRight: '1rem', 
                                    padding: '0.5rem 1rem', 
                                    backgroundColor: '#6c757d', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '4px', 
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSendMessage}
                                disabled={isLoading || !newMessageRecipientEmail || !newMessageText}
                                style={{
                                    padding: '0.5rem 1rem', 
                                    backgroundColor: '#007bff', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '4px', 
                                    cursor: 'pointer',
                                    opacity: (isLoading || !newMessageRecipientEmail || !newMessageText) ? 0.6 : 1
                                }}
                            >
                                {isLoading ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW: Message History Modal */}
            {isHistoryModalOpen && (
                <div style={{
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    background: 'rgba(0,0,0,0.5)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.95)', 
                        padding: '2rem', 
                        borderRadius: '8px', 
                        width: '500px', 
                        maxHeight: '70vh', 
                        overflowY: 'auto',
                        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <h3 style={{ marginBottom: '1rem' }}>Conversation History</h3>
                        {messageHistory.length > 0 ? (
                            messageHistory.map(msg => (
                                <div key={msg.messageId} style={{
                                    marginBottom: '1rem', 
                                    padding: '1rem', 
                                    border: '1px solid #eee', 
                                    borderRadius: '4px',
                                    backgroundColor: msg.senderUid === auth.currentUser?.uid ? '#e3f2fd' : '#f5f5f5'
                                }}>
                                    <p style={{ margin: 0, fontSize: '0.8em', color: '#555' }}>
                                        <strong>From:</strong> <code>{msg.senderUid}</code>
                                    </p>
                                    <p style={{ margin: '0.5rem 0' }}>{msg.textMessage}</p>
                                    {msg.originalFilename && (
                                        <p style={{ fontSize: '0.8em', color: '#888' }}>
                                            <em>Shared document: {msg.originalFilename}</em>
                                        </p>
                                    )}
                                    <p style={{ fontSize: '0.7em', color: '#999', margin: '0.5rem 0 0 0' }}>
                                        {new Date(msg.timestamp?.toDate?.() || msg.timestamp).toLocaleString()}
                                    </p>
                                </div>
                            ))
                        ) : <p>No messages in this conversation yet.</p>}
                        <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '1rem'}}>
                            <button 
                                onClick={() => setIsHistoryModalOpen(false)}
                                style={{
                                    padding: '0.5rem 1rem', 
                                    backgroundColor: '#6c757d', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '4px', 
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
