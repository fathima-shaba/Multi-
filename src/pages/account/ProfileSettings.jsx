import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { accountRequest } from '../../api/account';

export default function ProfileSettings({ user }) {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState({ name: user.name, email: user.email, phone: user.phone || '', currentPassword: '' });
  const [profileNotice, setProfileNotice] = useState(null);
  const [passwordNotice, setPasswordNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setProfileNotice(null);
    try {
      const changes = {
        name: profile.name, email: profile.email,
        ...(profile.phone || user.phone ? { phone: profile.phone } : {}),
        ...(profile.email.trim().toLowerCase() !== user.email ? { currentPassword: profile.currentPassword } : {}),
      };
      const { user: saved } = await accountRequest('/users/me', { method: 'PATCH', body: changes });
      updateUser(saved);
      setProfile({ name: saved.name, email: saved.email, phone: saved.phone || '', currentPassword: '' });
      setProfileNotice({ text: 'Profile updated.' });
    } catch (error) {
      setProfileNotice({ text: error.message, error: true });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { currentPassword, newPassword, confirmPassword } = Object.fromEntries(new FormData(form));
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ text: 'New passwords must match.', error: true });
      return;
    }
    setChanging(true);
    setPasswordNotice(null);
    try {
      await accountRequest('/users/me/password', { method: 'PATCH', body: { currentPassword, newPassword } });
      form.reset();
      setPasswordNotice({ text: 'Password changed. Other sessions were signed out.' });
    } catch (error) {
      setPasswordNotice({ text: error.message, error: true });
    } finally {
      setChanging(false);
    }
  }

  const emailChanged = profile.email.trim().toLowerCase() !== user.email;
  const change = event => setProfile({ ...profile, [event.target.name]: event.target.value });
  return (
    <div className="account-settings">
      <section className="card">
        <h3>Profile details</h3>
        <form aria-label="Profile details" className="account-form" onSubmit={saveProfile}>
          <label>Full name<input name="name" className="input" value={profile.name} onChange={change} autoComplete="name" minLength={2} maxLength={100} required /></label>
          <label>Email address<input type="email" name="email" className="input" value={profile.email} onChange={change} autoComplete="email" maxLength={254} required /></label>
          <label>Phone number<input type="tel" name="phone" className="input" value={profile.phone} onChange={change} autoComplete="tel-national" pattern="[0-9]{10}" required={Boolean(user.phone)} /></label>
          {emailChanged && <label>Current password to change email<input type="password" name="currentPassword" className="input" value={profile.currentPassword} onChange={change} autoComplete="current-password" required maxLength={128} /></label>}
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
          {profileNotice && <p role={profileNotice.error ? 'alert' : 'status'}>{profileNotice.text}</p>}
        </form>
      </section>
      <section className="card">
        <h3>Change password</h3>
        <form aria-label="Change password" className="account-form" onSubmit={changePassword}>
          <label>Current password<input type="password" name="currentPassword" className="input" autoComplete="current-password" required maxLength={128} /></label>
          <label>New password<input type="password" name="newPassword" className="input" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <label>Confirm new password<input type="password" name="confirmPassword" className="input" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <button className="btn btn-primary" disabled={changing}>{changing ? 'Changing…' : 'Change Password'}</button>
          {passwordNotice && <p role={passwordNotice.error ? 'alert' : 'status'}>{passwordNotice.text}</p>}
        </form>
      </section>
    </div>
  );
}
