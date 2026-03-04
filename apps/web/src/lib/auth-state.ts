let _isSigningOut = false;

export function getIsSigningOut() {
	return _isSigningOut;
}

export function setIsSigningOut(value: boolean) {
	_isSigningOut = value;
}
