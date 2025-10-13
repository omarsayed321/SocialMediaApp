import { Schema, Types, model, models, HydratedDocument} from "mongoose";

export interface IFriendRequest{
  createdBy: Types.ObjectId;
  sendTo?: Types.ObjectId;
  acceptedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type HFriendRequestDocument = HydratedDocument<IFriendRequest>;

const friendRequestSchema = new Schema<IFriendRequest>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sendTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    acceptedAt: Date,
  },
  { 
    timestamps: true,
    strictQuery: true,
  }
);

friendRequestSchema.pre(["updateOne", "findOneAndUpdate"], function(next){
  const query = this.getQuery();
  if(query.paranoid === false){
    this.setQuery({...query});
  }else{
    this.setQuery({...query, freezedAt: {$exists:false}});
  }
  next();
});

friendRequestSchema.pre(["find", "findOne", "countDocuments"], function(next){
  const query = this.getQuery();
  if(query.paranoid === false){
    this.setQuery({...query});
  }else{
    this.setQuery({...query, freezedAt: {$exists:false}});
  }
  next();
});


export const FriendRequestModel = models.FriendRequest || model<IFriendRequest>("FriendRequest", friendRequestSchema);
