import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Avatar,
  Typography,
  Divider,
  Chip,
  Button,
  Container,
  Stack,
  useTheme,
  CircularProgress,
  IconButton
} from '@mui/material';
import {
  Google as GoogleIcon,
  Email as EmailIcon,
  GitHub as GitHubIcon,
  Edit as EditIcon,
  Logout as LogoutIcon,
  VerifiedUser as VerifiedIcon,
  Person as PersonIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useAuth } from '@/hooks/useAuth'; 
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter'; // Assuming wouter based on context

// --- Helper to get Provider Icon & Label ---
const getProviderInfo = (providerId?: string) => {
  if (providerId === 'anonymous') {
    return { icon: <PersonIcon fontSize="small" />, label: 'Guest Access', color: 'default' as const };
  }
  
  if (providerId === 'google') {
    return { icon: <GoogleIcon fontSize="small" />, label: 'Google', color: 'error' as const };
  }
  
  if (providerId === 'github') {
    return { icon: <GitHubIcon fontSize="small" />, label: 'GitHub', color: 'default' as const };
  }

  // Default fallback
  return { icon: <EmailIcon fontSize="small" />, label: 'Email', color: 'primary' as const };
};

export default function ProfilePage() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [, setLocation] = useLocation(); 
  
  // 1. Get User Data
  const { user, isLoading, logout } = useAuth(); 
  
  // State to handle broken image URLs
  const [imgError, setImgError] = useState(false);

  // 2. Loading State
  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // 3. No User State
  if (!user) {
    return (
        <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
            <Typography variant="h6">Please log in to view your profile.</Typography>
        </Container>
    );
  }

  // 4. Smart Data Extraction
  const isGuest = user.id === 'guest' || !user.email;
  const nameParts = [user.firstName, user.lastName].filter(Boolean);
  const displayName = nameParts.length > 0 ? nameParts.join(' ') : (isGuest ? "Guest User" : "User");

  // Determine Provider ID
  let providerId = 'email'; 
  if (isGuest) {
      providerId = 'anonymous';
  } else if (
      (user as any).googleId || 
      (user.profileImageUrl && user.profileImageUrl.includes('googleusercontent.com'))
  ) {
      providerId = 'google';
  } else if ((user as any).githubId) {
      providerId = 'github';
  }

  const { icon, label, color } = getProviderInfo(providerId);

  // --- DYNAMIC AMBIENT COLOR LOGIC ---
  const getAmbientColor = () => {
    switch (providerId) {
      case 'google': return theme.palette.error.main; // Redish for Google
      case 'github': return '#24292e'; // GitHub Black/Dark Grey
      case 'anonymous': return theme.palette.grey[500]; // Grey for Guest
      default: return theme.palette.primary.main; // Blue for Email
    }
  };
  
  const ambientColor = getAmbientColor();

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card 
        elevation={6} // Increased elevation for pop
        sx={{ 
          borderRadius: 4, 
          overflow: 'hidden', // Changed to hidden to clip the gradient cleanly
          mt: 5,
          position: 'relative' // Needed for absolute positioning of back button
        }}
      >
        {/* Dynamic Header Background */}
        <Box sx={{ 
            height: 140, 
            background: `linear-gradient(135deg, ${ambientColor} 0%, ${theme.palette.background.paper} 150%)`,
            display: 'flex',
            alignItems: 'flex-start',
            p: 2
        }}>
            {/* BACK / CLOSE BUTTON */}
            <IconButton 
                onClick={() => setLocation('/')} // Navigates home or back
                sx={{ 
                    color: 'white', 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.3)' }
                }}
            >
                <ArrowBackIcon />
            </IconButton>
        </Box>

        <Box sx={{ position: 'relative', px: 3, pb: 3, textAlign: 'center', mt: -7 }}>
            
          {/* Avatar Section */}
          <Avatar
            src={
              !imgError && user.profileImageUrl && !user.profileImageUrl.includes('picture/1') 
                ? user.profileImageUrl 
                : undefined
            }
            alt={displayName}
            imgProps={{ onError: () => setImgError(true) }}
            sx={{
              width: 120,
              height: 120,
              border: `4px solid ${theme.palette.background.paper}`,
              margin: '0 auto', // Centers the avatar
              boxShadow: theme.shadows[3],
              bgcolor: isGuest ? theme.palette.grey[500] : ambientColor,
              fontSize: 40
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>

          <CardContent sx={{ mt: 2 }}>
            {/* Name & Verification */}
            <Stack direction="row" alignItems="center" justifyContent="center" gap={1} mb={0.5}>
              <Typography variant="h5" fontWeight="bold">
                {displayName}
              </Typography>
              
              {!isGuest && user.isEmailVerified && (
                <VerifiedIcon sx={{ color: ambientColor }} fontSize="small" titleAccess="Verified User" />
              )}
            </Stack>
            
            <Divider sx={{ my: 3 }} />

            {/* Account Details */}
            <Stack spacing={2} alignItems="center">
              
              {/* Registered Email */}
              <Box width="100%">
                <Typography variant="caption" display="block" color="text.secondary" gutterBottom>
                  REGISTERED EMAIL
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ fontStyle: isGuest ? 'italic' : 'normal', color: isGuest ? 'text.secondary' : 'text.primary' }}>
                  {isGuest ? "No registered email (Guest)" : user.email || 'No email provided'}
                </Typography>
              </Box>

              {/* Sign-in Method */}
              <Box width="100%">
                <Typography variant="caption" display="block" color="text.secondary" gutterBottom>
                  SIGN-UP METHOD
                </Typography>
                <Chip
                  icon={icon}
                  label={isGuest ? "Guest Access" : `Signed up with ${label}`}
                  variant="outlined"
                  color={color}
                  sx={{ fontWeight: 500, py: 2 }}
                />
              </Box>

            </Stack>

            {/* Action Buttons */}
            <Stack direction="row" spacing={2} justifyContent="center" mt={4}>
              <Button 
                variant="outlined" 
                startIcon={<EditIcon />}
                disabled={true} 
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                Edit Profile
              </Button>
              <Button 
                variant="contained" 
                color="error" 
                startIcon={<LogoutIcon />}
                onClick={logout}
                sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
              >
                Sign Out
              </Button>
            </Stack>
            
          </CardContent>
        </Box>
      </Card>
    </Container>
  );
}