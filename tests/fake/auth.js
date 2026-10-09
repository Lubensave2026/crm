export const getAuth=()=>({currentUser:null});
export const signInAnonymously=async a=>{a.currentUser={uid:'test-uid'};return {user:a.currentUser}};
