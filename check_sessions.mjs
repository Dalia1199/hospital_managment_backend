import { MongoClient, ObjectId } from 'mongodb';
const client = await MongoClient.connect('mongodb://carehub601_db_user:Carehub_final_654321@ac-frjnfki-shard-00-00.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-01.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-02.0dghj7n.mongodb.net:27017/?ssl=true&replicaSet=atlas-6e7ni4-shard-0&authSource=admin&appName=Cluster0');
const db = client.db('test');

const doctorId = '6a25851156c2f76e8bf32bff';
const doctorUser = await db.collection('users').findOne({ _id: new ObjectId(doctorId) });
console.log('Doctor user found:', !!doctorUser, 'role:', doctorUser?.role, 'name:', doctorUser?.fullName);

const sessions = await db.collection('sessions').find({ doctorId: new ObjectId(doctorId) }).toArray();
console.log('Sessions with this doctorId:', sessions.length);
sessions.forEach(s => console.log(JSON.stringify({ id: s._id, status: s.status, patientId: s.patientId, isOffline: s.isOfflinePatient, guestName: s.guestName, clinicId: s.clinicId })));

// Also check if any sessions have different doctorId format (string vs ObjectId)
const allSessions = await db.collection('sessions').find({}).toArray();
console.log('\nAll sessions count:', allSessions.length);
allSessions.forEach(s => console.log(JSON.stringify({ id: s._id, doctorId: s.doctorId, status: s.status })));

await client.close();
