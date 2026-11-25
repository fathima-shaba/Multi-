export async function auditAdmin(client,actorId,action,targetType,targetId) {
  await client.query(`INSERT INTO admin_activity(actor_user_id,actor_name,action,target_type,target_id)
    SELECT id,name,$2,$3,$4 FROM users WHERE id=$1 AND role='admin'`,
  [actorId,action,targetType,String(targetId)]);
}
